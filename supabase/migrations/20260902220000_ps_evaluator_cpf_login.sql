CREATE OR REPLACE FUNCTION public.ps_evaluator_cpf_for_collaborator(p_collaborator_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN length(regexp_replace(c.cpf, '[^0-9]', '', 'g')) = 11 THEN regexp_replace(c.cpf, '[^0-9]', '', 'g')
    ELSE NULL
  END
  FROM public.ps_collaborators c
  WHERE c.id = p_collaborator_id;
$$;

DO $$
DECLARE
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_cpf text;
  v_duplicates integer;
BEGIN
  FOR v_account IN SELECT * FROM public.ps_evaluator_accounts LOOP
    v_cpf := public.ps_evaluator_cpf_for_collaborator(v_account.collaborator_id);
    SELECT count(*)::integer INTO v_duplicates FROM public.ps_evaluator_accounts other
    WHERE other.event_id = v_account.event_id AND other.username = v_cpf AND other.id <> v_account.id;
    IF v_cpf IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ps_evaluator_accounts other
      WHERE other.event_id = v_account.event_id
        AND other.username = v_cpf
        AND other.id <> v_account.id
    ) THEN
      IF v_account.must_change_password = false THEN
        UPDATE public.ps_evaluator_accounts SET username = v_cpf WHERE id = v_account.id;
      ELSE
        UPDATE public.ps_evaluator_accounts
        SET username = v_cpf,
            password_hash = extensions.crypt(v_cpf, extensions.gen_salt('bf', 12)),
            must_change_password = true,
            password_changed_at = NULL,
            failed_login_attempts = 0,
            locked_until = NULL
        WHERE id = v_account.id;
        DELETE FROM public.ps_evaluator_sessions WHERE account_id = v_account.id AND revoked_at IS NULL;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ps_admin_create_evaluator_account(
  p_event_id uuid,
  p_collaborator_id uuid,
  p_role text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_account_id uuid;
  v_username text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'evaluator_account_admin_required'; END IF;
  IF p_role NOT IN ('coordinator', 'subcoordinator') THEN RAISE EXCEPTION 'invalid_evaluator_role'; END IF;
  v_username := public.ps_evaluator_cpf_for_collaborator(p_collaborator_id);
  IF p_event_id IS NULL OR v_username IS NULL OR length(v_username) <> 11 OR NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'evaluator_account_cpf_required';
  END IF;
  INSERT INTO public.ps_evaluator_accounts (event_id, collaborator_id, username, password_hash, role, must_change_password)
  VALUES (p_event_id, p_collaborator_id, v_username, extensions.crypt(v_username, extensions.gen_salt('bf', 12)), p_role, true)
  RETURNING id INTO v_account_id;
  RETURN v_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_evaluator_cpf_for_collaborator(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_reset_evaluator_password(p_account_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_cpf text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'evaluator_admin_required'; END IF;
  SELECT public.ps_evaluator_cpf_for_collaborator(collaborator_id) INTO v_cpf
  FROM public.ps_evaluator_accounts WHERE id = p_account_id FOR UPDATE;
  IF v_cpf IS NULL OR length(v_cpf) <> 11 THEN RETURN false; END IF;
  UPDATE public.ps_evaluator_accounts
  SET username = v_cpf,
      password_hash = extensions.crypt(v_cpf, extensions.gen_salt('bf', 12)),
      must_change_password = true, password_changed_at = NULL,
      failed_login_attempts = 0, locked_until = NULL
  WHERE id = p_account_id;
  UPDATE public.ps_evaluator_sessions SET revoked_at = now() WHERE account_id = p_account_id AND revoked_at IS NULL;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_sync_imported_evaluators(
  p_event_id uuid,
  p_event_collaborator_ids uuid[]
) RETURNS TABLE (fiscais_importados integer, subcoordenadores_identificados integer, coordenadores_identificados integer, contas_criadas integer, contas_sincronizadas integer, escopos_criados integer, escopos_local_incompleto integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_role_record record;
  v_role text;
  v_username text;
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_scope_type text;
  v_scope_count integer;
  v_conflict_count integer;
  v_fiscais integer := 0;
  v_subcoordenadores integer := 0;
  v_coordenadores integer := 0;
  v_contas_criadas integer := 0;
  v_contas_sincronizadas integer := 0;
  v_escopos_criados integer := 0;
  v_escopos_incompletos integer := 0;
BEGIN
  IF NOT public.is_internal_user(auth.uid()) THEN RAISE EXCEPTION 'evaluator_sync_internal_user_required'; END IF;
  FOR v_link IN SELECT ec.* FROM public.ps_event_collaborators ec WHERE ec.event_id = p_event_id AND (p_event_collaborator_ids IS NULL OR ec.id = ANY(p_event_collaborator_ids)) ORDER BY ec.id LOOP
    v_fiscais := v_fiscais + 1;
    v_role := NULL;
    SELECT r.value, r.name INTO v_role_record FROM public.ps_roles r
    WHERE lower(r.value) IN (lower(trim(coalesce(v_link.role_value, ''))), lower(trim(coalesce(v_link.assigned_role, ''))), lower(trim(coalesce(v_link.role_name, ''))))
       OR lower(r.name) IN (lower(trim(coalesce(v_link.role_value, ''))), lower(trim(coalesce(v_link.assigned_role, ''))), lower(trim(coalesce(v_link.role_name, ''))))
    ORDER BY r.active DESC LIMIT 1;
    IF v_role_record.value IS NOT NULL THEN v_role := lower(v_role_record.value || ' ' || v_role_record.name); ELSE v_role := lower(coalesce(v_link.role_value, '') || ' ' || coalesce(v_link.assigned_role, '') || ' ' || coalesce(v_link.role_name, '')); END IF;
    IF v_role LIKE '%sub%coord%' OR v_role LIKE '%subcoord%' THEN v_role := 'subcoordinator'; v_subcoordenadores := v_subcoordenadores + 1;
    ELSIF v_role LIKE '%coord%' THEN v_role := 'coordinator'; v_coordenadores := v_coordenadores + 1; ELSE v_role := NULL; END IF;
    v_username := public.ps_evaluator_cpf_for_collaborator(v_link.collaborator_id);
    IF v_username IS NOT NULL THEN
      SELECT count(*)::integer INTO v_conflict_count FROM public.ps_evaluator_accounts other
      WHERE other.event_id = p_event_id AND other.username = v_username AND other.collaborator_id <> v_link.collaborator_id;
      IF v_conflict_count > 0 THEN v_username := NULL; END IF;
    END IF;
    SELECT * INTO v_account FROM public.ps_evaluator_accounts WHERE event_id = p_event_id AND collaborator_id = v_link.collaborator_id FOR UPDATE;
    IF v_role IS NULL OR v_username IS NULL THEN
      IF FOUND THEN UPDATE public.ps_evaluator_accounts SET active = false WHERE id = v_account.id; UPDATE public.ps_evaluator_sessions SET revoked_at = now() WHERE account_id = v_account.id AND revoked_at IS NULL; DELETE FROM public.ps_event_evaluator_scopes WHERE event_id = p_event_id AND evaluator_event_collaborator_id = v_link.id AND source = 'import'; END IF;
      CONTINUE;
    END IF;
    IF NOT FOUND THEN
      INSERT INTO public.ps_evaluator_accounts (event_id, collaborator_id, username, password_hash, role, must_change_password, active)
      VALUES (p_event_id, v_link.collaborator_id, v_username, extensions.crypt(v_username, extensions.gen_salt('bf', 12)), v_role, true, true) RETURNING * INTO v_account;
      v_contas_criadas := v_contas_criadas + 1;
    ELSE
      UPDATE public.ps_evaluator_accounts SET username = v_username, role = v_role, active = true WHERE id = v_account.id;
      v_contas_sincronizadas := v_contas_sincronizadas + 1;
    END IF;
    DELETE FROM public.ps_event_evaluator_scopes WHERE event_id = p_event_id AND evaluator_event_collaborator_id = v_link.id AND source = 'import';
    IF v_role = 'coordinator' THEN v_scope_type := 'event';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL AND nullif(trim(v_link.building), '') IS NOT NULL AND nullif(trim(v_link.floor), '') IS NOT NULL THEN v_scope_type := 'floor';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL AND nullif(trim(v_link.building), '') IS NOT NULL THEN v_scope_type := 'building';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL THEN v_scope_type := 'campus';
    ELSE v_scope_type := NULL; v_escopos_incompletos := v_escopos_incompletos + 1; END IF;
    IF v_scope_type IS NOT NULL THEN
      INSERT INTO public.ps_event_evaluator_scopes (event_id, evaluator_event_collaborator_id, campus, building, floor, scope_type, source)
      VALUES (p_event_id, v_link.id, v_link.campus, v_link.building, v_link.floor, v_scope_type, 'import') ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_scope_count = ROW_COUNT; v_escopos_criados := v_escopos_criados + v_scope_count;
    END IF;
  END LOOP;
  RETURN QUERY SELECT v_fiscais, v_subcoordenadores, v_coordenadores, v_contas_criadas, v_contas_sincronizadas, v_escopos_criados, v_escopos_incompletos;
END;
$$;