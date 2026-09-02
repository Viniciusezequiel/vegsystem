-- Admin-only wrapper for ps_sync_imported_evaluators, allowing safe manual/import
-- synchronization runs (e.g. from the SQL Editor) without weakening the
-- internal-user protection already enforced inside ps_sync_imported_evaluators.
CREATE OR REPLACE FUNCTION public.ps_admin_sync_imported_evaluators(
  p_event_id uuid,
  p_event_collaborator_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  fiscais_importados integer,
  subcoordenadores_identificados integer,
  coordenadores_identificados integer,
  contas_criadas integer,
  contas_sincronizadas integer,
  escopos_criados integer,
  escopos_local_incompleto integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'evaluator_admin_required';
  END IF;

  RETURN QUERY
  SELECT * FROM public.ps_sync_imported_evaluators(p_event_id, p_event_collaborator_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_sync_imported_evaluators(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_sync_imported_evaluators(uuid, uuid[]) TO authenticated;
