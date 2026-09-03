-- Portal dos Avaliadores: fully synchronize removals of coordinators/subcoordinators.
-- ps_sync_imported_evaluators now deactivates orphaned accounts, revokes their
-- sessions and clears their import-sourced scopes BEFORE processing current links.
-- ps_admin_list_evaluator_accounts only lists accounts currently linked to the event.
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

  -- Deactivate accounts whose collaborator no longer has a link in ps_event_collaborators,
  -- revoke their active sessions and drop only their import-sourced scopes.
  WITH orphaned AS (
    SELECT a.id, a.collaborator_id
    FROM public.ps_evaluator_accounts a
    WHERE a.event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.ps_event_collaborators ec
        WHERE ec.event_id = p_event_id
          AND ec.collaborator_id = a.collaborator_id
      )
  ),
  deactivated AS (
    UPDATE public.ps_evaluator_accounts a
    SET active = false
    FROM orphaned o
    WHERE a.id = o.id
    RETURNING a.id
  ),
  revoked AS (
    UPDATE public.ps_evaluator_sessions s
    SET revoked_at = now()
    FROM orphaned o
    WHERE s.account_id = o.id
      AND s.revoked_at IS NULL
    RETURNING s.id
  )
  DELETE FROM public.ps_event_evaluator_scopes es
  USING orphaned o
  WHERE es.event_id = p_event_id
    AND es.source = 'import'
    AND es.evaluator_event_collaborator_id IN (
      SELECT ec.id FROM public.ps_event_collaborators ec
      WHERE ec.event_id = p_event_id AND ec.collaborator_id = o.collaborator_id
    );

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

    v_username := public.ps_evaluator_cpf_for_collaborator(v_link.collaborator_id);

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
      -- Preserve custom passwords. If the evaluator still uses the initial
      -- password, realign both username and initial password to CPF.
      IF v_account.must_change_password
         AND v_account.username IS DISTINCT FROM v_username THEN
        UPDATE public.ps_evaluator_accounts
        SET username = v_username,
            password_hash = extensions.crypt(v_username, extensions.gen_salt('bf', 12)),
            role = v_role,
            active = true,
            password_changed_at = NULL,
            failed_login_attempts = 0,
            locked_until = NULL
        WHERE id = v_account.id;

        UPDATE public.ps_evaluator_sessions
        SET revoked_at = now()
        WHERE account_id = v_account.id
          AND revoked_at IS NULL;
      ELSE
        UPDATE public.ps_evaluator_accounts
        SET username = v_username, role = v_role, active = true
        WHERE id = v_account.id;
      END IF;

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

CREATE OR REPLACE FUNCTION public.ps_admin_list_evaluator_accounts(
  p_event_id uuid
) RETURNS TABLE (
  account_id uuid,
  event_id uuid,
  collaborator_id uuid,
  evaluator_name text,
  username text,
  role text,
  campus text,
  building text,
  floor text,
  scope_type text,
  scope_source text,
  active boolean,
  last_login timestamptz,
  scope_state text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.event_id, a.collaborator_id, c.full_name, a.username, a.role,
    s.campus, s.building, s.floor, s.scope_type, s.source, a.active, a.last_login,
    CASE WHEN s.id IS NULL THEN 'pending'
         WHEN s.source = 'manual' THEN 'adjusted'
         ELSE 'configured' END
  FROM public.ps_evaluator_accounts a
  JOIN public.ps_collaborators c ON c.id = a.collaborator_id
  LEFT JOIN LATERAL (
    SELECT es.* FROM public.ps_event_evaluator_scopes es
    WHERE es.event_id = a.event_id
      AND es.evaluator_event_collaborator_id IN (
        SELECT ec.id FROM public.ps_event_collaborators ec
        WHERE ec.event_id = a.event_id AND ec.collaborator_id = a.collaborator_id
      )
    ORDER BY (es.source = 'manual') DESC, es.created_at DESC
    LIMIT 1
  ) s ON true
  WHERE a.event_id = p_event_id
    AND a.active = true
    AND EXISTS (
      SELECT 1 FROM public.ps_event_collaborators ec
      WHERE ec.event_id = a.event_id AND ec.collaborator_id = a.collaborator_id
    )
    AND public.is_admin(auth.uid());
$$;
