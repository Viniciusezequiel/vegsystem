-- Remote hotfix: ps_sync_imported_evaluators must deactivate evaluator accounts
-- whose collaborator no longer has a link in ps_event_collaborators for the event,
-- and revoke any active sessions for those accounts.
CREATE OR REPLACE FUNCTION public.ps_sync_imported_evaluators(
  p_event_id uuid,
  p_event_collaborator_ids uuid[]
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
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_role_record record;
  v_role text;
  v_username text;
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_scope_type text;
  v_scope_count integer;
  v_fiscais integer := 0;
  v_subcoordenadores integer := 0;
  v_coordenadores integer := 0;
  v_contas_criadas integer := 0;
  v_contas_sincronizadas integer := 0;
  v_escopos_criados integer := 0;
  v_escopos_incompletos integer := 0;
BEGIN
  IF NOT public.is_internal_user(auth.uid()) THEN
    RAISE EXCEPTION 'evaluator_sync_internal_user_required';
  END IF;

  -- Deactivate accounts whose collaborator link was removed from the event
  -- and revoke their active sessions
  WITH orphaned AS (
    UPDATE public.ps_evaluator_accounts a
    SET active = false
    WHERE a.event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.ps_event_collaborators ec
        WHERE ec.event_id = p_event_id
          AND ec.collaborator_id = a.collaborator_id
      )
    RETURNING a.id
  )
  UPDATE public.ps_evaluator_sessions s
  SET revoked_at = now()
  FROM orphaned o
  WHERE s.account_id = o.id
    AND s.revoked_at IS NULL;

  FOR v_link IN
    SELECT ec.*
    FROM public.ps_event_collaborators ec
    WHERE ec.event_id = p_event_id
      AND (p_event_collaborator_ids IS NULL OR ec.id = ANY(p_event_collaborator_ids))
    ORDER BY ec.id
  LOOP
    v_fiscais := v_fiscais + 1;
    v_role := NULL;
    SELECT r.value, r.name INTO v_role_record
    FROM public.ps_roles r
    WHERE lower(r.value) = lower(trim(coalesce(v_link.assigned_role, '')))
       OR lower(r.name) = lower(trim(coalesce(v_link.assigned_role, '')))
    ORDER BY r.active DESC
    LIMIT 1;

    v_role := lower(coalesce(v_link.assigned_role, ''));

    IF v_role LIKE '%sub%' AND v_role LIKE '%coord%' THEN
      v_role := 'subcoordinator';
      v_subcoordenadores := v_subcoordenadores + 1;
    ELSIF v_role LIKE '%coord%' THEN
      v_role := 'coordinator';
      v_coordenadores := v_coordenadores + 1;
    ELSE
      v_role := NULL;
    END IF;

    SELECT nullif(regexp_replace(c.matricula, '[^0-9A-Za-z]', '', 'g'), '')
      INTO v_username
    FROM public.ps_collaborators c
    WHERE c.id = v_link.collaborator_id;

    SELECT * INTO v_account
    FROM public.ps_evaluator_accounts
    WHERE event_id = p_event_id
      AND collaborator_id = v_link.collaborator_id
    FOR UPDATE;

    IF v_role IS NULL OR v_username IS NULL THEN
      IF FOUND THEN
        UPDATE public.ps_evaluator_accounts
        SET active = false
        WHERE id = v_account.id;
        DELETE FROM public.ps_evaluator_sessions
        WHERE account_id = v_account.id AND revoked_at IS NULL;
        DELETE FROM public.ps_event_evaluator_scopes
        WHERE event_id = p_event_id
          AND evaluator_event_collaborator_id = v_link.id
          AND source = 'import';
      END IF;
      CONTINUE;
    END IF;

    IF NOT FOUND THEN
      INSERT INTO public.ps_evaluator_accounts (
        event_id, collaborator_id, username, password_hash, role,
        must_change_password, active
      ) VALUES (
        p_event_id,
        v_link.collaborator_id,
        v_username,
        extensions.crypt(v_username, extensions.gen_salt('bf', 12)),
        v_role,
        true,
        true
      ) RETURNING * INTO v_account;
      v_contas_criadas := v_contas_criadas + 1;
    ELSE
      UPDATE public.ps_evaluator_accounts
      SET username = v_username, role = v_role, active = true
      WHERE id = v_account.id;
      v_contas_sincronizadas := v_contas_sincronizadas + 1;
    END IF;

    DELETE FROM public.ps_event_evaluator_scopes
    WHERE event_id = p_event_id
      AND evaluator_event_collaborator_id = v_link.id
      AND source = 'import';

    IF v_role = 'coordinator' THEN
      v_scope_type := 'event';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL
      AND nullif(trim(v_link.building), '') IS NOT NULL
      AND nullif(trim(v_link.floor), '') IS NOT NULL THEN
      v_scope_type := 'floor';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL
      AND nullif(trim(v_link.building), '') IS NOT NULL THEN
      v_scope_type := 'building';
    ELSIF nullif(trim(v_link.campus), '') IS NOT NULL THEN
      v_scope_type := 'campus';
    ELSE
      v_scope_type := NULL;
      v_escopos_incompletos := v_escopos_incompletos + 1;
    END IF;

    IF v_scope_type IS NOT NULL THEN
      INSERT INTO public.ps_event_evaluator_scopes (
        event_id, evaluator_event_collaborator_id, campus, building, floor, scope_type, source
      ) VALUES (
        p_event_id, v_link.id, v_link.campus, v_link.building, v_link.floor, v_scope_type, 'import'
      )
      ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_scope_count = ROW_COUNT;
      v_escopos_criados := v_escopos_criados + v_scope_count;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_fiscais, v_subcoordenadores, v_coordenadores, v_contas_criadas,
    v_contas_sincronizadas, v_escopos_criados, v_escopos_incompletos;
END;
$$;
