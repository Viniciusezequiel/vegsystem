BEGIN;

CREATE OR REPLACE FUNCTION public.ps_admin_update_event_collaborator_details(
  p_event_collaborator_id uuid,
  p_patch jsonb,
  p_assignments jsonb
)
RETURNS TABLE(link_id uuid, assignments_count integer, total_pay numeric)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.ps_event_collaborators%rowtype;
  v_count integer;
  v_total numeric;
  v_pix text;
BEGIN
  SELECT * INTO v_link
  FROM public.ps_event_collaborators
  WHERE id = p_event_collaborator_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'event_collaborator_not_found'; END IF;
  IF jsonb_typeof(COALESCE(p_patch, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'invalid_event_collaborator_patch';
  END IF;

  v_pix := NULLIF(trim(p_patch->>'pix'), '');

  UPDATE public.ps_event_collaborators
  SET collaborator_name = COALESCE(NULLIF(trim(p_patch->>'collaborator_name'), ''), collaborator_name),
      building = NULLIF(trim(p_patch->>'building'), ''),
      floor = NULLIF(trim(p_patch->>'floor'), ''),
      room = NULLIF(trim(p_patch->>'room'), ''),
      campus = NULLIF(trim(p_patch->>'campus'), ''),
      sector = NULLIF(trim(p_patch->>'sector'), ''),
      email = NULLIF(trim(p_patch->>'email'), ''),
      phone = NULLIF(trim(p_patch->>'phone'), ''),
      mobile = NULLIF(trim(p_patch->>'mobile'), ''),
      pix = v_pix,
      deposit_info = NULLIF(trim(p_patch->>'deposit_info'), '')
  WHERE id = p_event_collaborator_id;

  IF v_link.collaborator_id IS NOT NULL AND v_pix IS NOT NULL THEN
    UPDATE public.ps_collaborators SET pix = v_pix WHERE id = v_link.collaborator_id;
  END IF;

  SELECT r.assignments_count, r.total_pay
  INTO v_count, v_total
  FROM public.ps_admin_replace_event_collaborator_assignments(p_event_collaborator_id, p_assignments) r;

  RETURN QUERY SELECT p_event_collaborator_id, v_count, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_update_event_collaborator_details(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_update_event_collaborator_details(uuid, jsonb, jsonb) TO authenticated;

COMMIT;
