-- ============================================================
-- Hardening das RPCs utilizadas pela migração de assinaturas R2.
--
-- Mantém SECURITY INVOKER + RLS.
-- Mantém execução pelo script administrativo existente.
-- Adiciona defesa explícita no banco:
-- somente admin autenticado pode executar.
-- ============================================================


-- ============================================================
-- EQUIPMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_equipment_signature_locator(
  p_loan_id uuid,
  p_field text,
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
  IF current_user <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT public.is_admin(auth.uid())
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_new_locator IS NULL
     OR p_new_locator NOT LIKE 'r2/signatures/equipment/%'
  THEN
    RAISE EXCEPTION 'invalid_equipment_signature_locator'
      USING ERRCODE = '22023';
  END IF;

  IF p_field = 'borrower_signature' THEN
    UPDATE public.equipment_loans
    SET borrower_signature = p_new_locator
    WHERE id = p_loan_id
      AND borrower_signature = p_expected_value;

  ELSIF p_field = 'return_signature' THEN
    UPDATE public.equipment_loans
    SET return_signature = p_new_locator
    WHERE id = p_loan_id
      AND return_signature = p_expected_value;

  ELSE
    RAISE EXCEPTION 'invalid_equipment_signature_field'
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY
  SELECT v_rows_updated = 1, v_rows_updated;
END;
$$;


-- ============================================================
-- LOCKERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_locker_signature_locator(
  p_loan_id uuid,
  p_field text,
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
  IF current_user <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT public.is_admin(auth.uid())
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_new_locator IS NULL
     OR p_new_locator NOT LIKE 'r2/signatures/lockers/%'
  THEN
    RAISE EXCEPTION 'invalid_locker_signature_locator'
      USING ERRCODE = '22023';
  END IF;

  IF p_field = 'borrower_signature' THEN
    UPDATE public.locker_loans
    SET borrower_signature = p_new_locator
    WHERE id = p_loan_id
      AND borrower_signature = p_expected_value;

  ELSIF p_field = 'return_signature' THEN
    UPDATE public.locker_loans
    SET return_signature = p_new_locator
    WHERE id = p_loan_id
      AND return_signature = p_expected_value;

  ELSE
    RAISE EXCEPTION 'invalid_locker_signature_field'
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY
  SELECT v_rows_updated = 1, v_rows_updated;
END;
$$;


-- ============================================================
-- LOST ITEMS
-- ============================================================

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
  IF current_user <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT public.is_admin(auth.uid())
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_new_locator IS NULL
     OR p_new_locator NOT LIKE 'r2/signatures/lost-items/%'
  THEN
    RAISE EXCEPTION 'invalid_lost_item_signature_locator'
      USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'invalid_lost_item_signature_source'
      USING ERRCODE = '22023';
  END IF;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY
  SELECT v_rows_updated = 1, v_rows_updated;
END;
$$;


-- ============================================================
-- PROCESS SELECTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_process_selection_signature_locator(
  p_loan_id uuid,
  p_field text,
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
  IF current_user <> 'service_role'
     AND (
       auth.uid() IS NULL
       OR NOT public.is_admin(auth.uid())
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_field <> 'signature_url' THEN
    RAISE EXCEPTION 'invalid_process_selection_signature_field'
      USING ERRCODE = '22023';
  END IF;

  IF p_new_locator IS NULL
     OR p_new_locator NOT LIKE
       'r2/signatures/process-selection/%'
  THEN
    RAISE EXCEPTION 'invalid_process_selection_signature_locator'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.ps_event_collaborators
  SET signature_url = p_new_locator
  WHERE id = p_loan_id
    AND signature_url = p_expected_value;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY
  SELECT v_rows_updated = 1, v_rows_updated;
END;
$$;


-- ============================================================
-- ACL
-- ============================================================

REVOKE ALL ON FUNCTION
  public.update_equipment_signature_locator(uuid, text, text, text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.update_locker_signature_locator(uuid, text, text, text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.update_lost_item_signature_locator(uuid, text, text, text)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION
  public.update_process_selection_signature_locator(uuid, text, text, text)
FROM PUBLIC, anon;


GRANT EXECUTE ON FUNCTION
  public.update_equipment_signature_locator(uuid, text, text, text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.update_locker_signature_locator(uuid, text, text, text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.update_lost_item_signature_locator(uuid, text, text, text)
TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION
  public.update_process_selection_signature_locator(uuid, text, text, text)
TO authenticated, service_role;
