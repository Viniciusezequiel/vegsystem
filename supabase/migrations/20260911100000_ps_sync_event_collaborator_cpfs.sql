CREATE OR REPLACE FUNCTION public.ps_sync_event_collaborator_cpfs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.ps_event_collaborators AS event_collaborator
  SET cpf = collaborator.cpf,
      updated_at = now()
  FROM public.ps_collaborators AS collaborator
  WHERE event_collaborator.collaborator_id = collaborator.id
    AND NULLIF(BTRIM(collaborator.cpf), '') IS NOT NULL
    AND event_collaborator.cpf IS DISTINCT FROM collaborator.cpf;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_sync_event_collaborator_cpfs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_sync_event_collaborator_cpfs() FROM anon;
GRANT EXECUTE ON FUNCTION public.ps_sync_event_collaborator_cpfs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ps_sync_event_collaborator_cpfs() TO service_role;

COMMENT ON FUNCTION public.ps_sync_event_collaborator_cpfs()
IS 'Sincroniza o CPF canônico do banco de fiscais com os vínculos já existentes em eventos.';
