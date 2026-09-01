CREATE OR REPLACE FUNCTION public.update_lost_item_signature_locator(
  p_record_id uuid,
  p_source text,
  p_expected_value text,
  p_new_locator text
)
RETURNS TABLE(success boolean, rows_updated integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows_updated integer := 0;
BEGIN
  IF p_new_locator IS NULL OR p_new_locator NOT LIKE 'r2/signatures/lost-items/%' THEN
    RAISE EXCEPTION 'invalid_lost_item_signature_locator' USING ERRCODE = '22023';
  END IF;

  IF p_source = 'active' THEN
    UPDATE public.lost_items
    SET owner_signature = p_new_locator
    WHERE id = p_record_id
      AND owner_signature = p_expected_value;
  ELSIF p_source = 'archive' THEN
    UPDATE public.lost_items_archive
    SET owner_signature = p_new_locator
    WHERE id = p_record_id
      AND owner_signature = p_expected_value;
  ELSE
    RAISE EXCEPTION 'invalid_lost_item_signature_source' USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN QUERY SELECT v_rows_updated = 1, v_rows_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_lost_item_signature_locator(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_lost_item_signature_locator(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_lost_item_signature_locator(uuid, text, text, text) TO authenticated;
