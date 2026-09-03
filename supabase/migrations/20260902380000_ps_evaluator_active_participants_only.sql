-- Portal do avaliador:
-- somente avaliadores e fiscais pertencentes à equipe operacional atual.

CREATE OR REPLACE FUNCTION public.ps_validate_evaluator_session(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE (
  valid boolean,
  must_change_password boolean,
  account_id uuid,
  collaborator_id uuid,
  evaluator_name text,
  role text,
  event_id uuid,
  event_name text,
  event_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL OR nullif(p_session_token, '') IS NULL THEN
    RETURN QUERY
    SELECT
      false,
      NULL::boolean,
      NULL::uuid,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    a.must_change_password,
    a.id,
    a.collaborator_id,
    c.full_name,
    a.role,
    s.event_id,
    e.name,
    e.date
  FROM public.ps_evaluator_sessions AS s
  JOIN public.ps_evaluator_accounts AS a
    ON a.id = s.account_id
  JOIN public.ps_collaborators AS c
    ON c.id = a.collaborator_id
  JOIN public.ps_events AS e
    ON e.id = s.event_id
  WHERE s.event_id = p_event_id
    AND s.session_token_hash =
      encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND a.event_id = s.event_id
    AND a.active
    AND a.role IN ('coordinator', 'subcoordinator')
    AND EXISTS (
      SELECT 1
      FROM public.ps_event_collaborators ec
      WHERE ec.event_id = s.event_id
        AND ec.collaborator_id = a.collaborator_id
        AND ec.participation_status IN (
          'pending_confirmation',
          'confirmed'
        )
        AND public.ps_evaluator_role_for_assignment(
          ec.role_value,
          ec.assigned_role,
          ec.role_name
        ) = a.role
    );

  IF FOUND THEN
    UPDATE public.ps_evaluator_sessions AS sess
    SET last_used_at = now()
    WHERE sess.session_token_hash =
      encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND sess.event_id = p_event_id
      AND sess.revoked_at IS NULL
      AND sess.expires_at > now();
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.ps_evaluator_link_can_access(
  p_event_id uuid,
  p_evaluator_event_collaborator_id uuid,
  p_evaluator_role text,
  p_target_event_collaborator_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ps_event_collaborators target
    WHERE target.id = p_target_event_collaborator_id
      AND target.event_id = p_event_id
      AND coalesce(target.absent, false) = false
      AND target.participation_status IN (
        'pending_confirmation',
        'confirmed'
      )
      AND target.collaborator_id IS NOT NULL
      AND target.collaborator_id <> (
        SELECT evaluator.collaborator_id
        FROM public.ps_event_collaborators evaluator
        WHERE evaluator.id = p_evaluator_event_collaborator_id
          AND evaluator.event_id = p_event_id
      )
      AND EXISTS (
        SELECT 1 FROM public.ps_collaborators c
        WHERE c.id = target.collaborator_id AND coalesce(c.active, true)
      )
      AND public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) IS NULL
      AND (
        p_evaluator_role = 'coordinator'
        OR (
          p_evaluator_role = 'subcoordinator'
          AND (
            EXISTS (
              SELECT 1
              FROM public.ps_event_evaluator_scopes scope
              JOIN public.ps_event_collaborators evaluator ON evaluator.id = scope.evaluator_event_collaborator_id
              WHERE scope.event_id = p_event_id
                AND scope.evaluator_event_collaborator_id = p_evaluator_event_collaborator_id
                AND scope.active
                AND (
                  (scope.scope_type = 'event')
                  OR (scope.scope_type = 'campus' AND scope.campus = target.campus)
                  OR (scope.scope_type = 'building' AND scope.campus = target.campus AND scope.building = target.building)
                  OR (scope.scope_type = 'floor' AND scope.campus = target.campus AND scope.building = target.building AND scope.floor = target.floor)
                )
            )
            OR EXISTS (
              SELECT 1 FROM public.ps_evaluation_scope_overrides override
              WHERE override.event_id = p_event_id
                AND override.evaluator_event_collaborator_id = p_evaluator_event_collaborator_id
                AND override.event_collaborator_id = p_target_event_collaborator_id
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_queue(
  p_event_id uuid,
  p_session_token text,
  p_search text DEFAULT NULL
) RETURNS TABLE (
  event_collaborator_id uuid,
  collaborator_id uuid,
  collaborator_name text,
  assigned_role text,
  role_name text,
  campus text,
  building text,
  floor text,
  room text,
  unit text,
  sector text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
  v_level text;
  v_query text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  SELECT *
  INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;

  IF NOT FOUND OR v_session.must_change_password THEN
    RETURN;
  END IF;

  v_level := CASE
    WHEN v_session.role = 'coordinator' THEN 'coordination'
    ELSE 'subcoordinator'
  END;

  SELECT evaluator_link.id
  INTO v_evaluator_link_id
  FROM public.ps_event_collaborators AS evaluator_link
  WHERE evaluator_link.event_id = p_event_id
    AND evaluator_link.collaborator_id = v_session.collaborator_id
    AND evaluator_link.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND public.ps_evaluator_role_for_assignment(
      evaluator_link.role_value,
      evaluator_link.assigned_role,
      evaluator_link.role_name
    ) = v_session.role
  ORDER BY evaluator_link.created_at DESC
  LIMIT 1;

  IF v_evaluator_link_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    target.id,
    target.collaborator_id,
    target.collaborator_name,
    target.assigned_role,
    target.role_name,
    target.campus,
    target.building,
    target.floor,
    target.room,
    target.unit,
    target.sector
  FROM public.ps_event_collaborators AS target
  WHERE target.event_id = p_event_id
    AND public.ps_evaluator_link_can_access(
      p_event_id,
      v_evaluator_link_id,
      v_session.role,
      target.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.ps_evaluations AS evaluation
      WHERE evaluation.event_id = p_event_id
        AND evaluation.collaborator_id = target.collaborator_id
        AND evaluation.evaluation_level = v_level
    )
    AND (
      v_query IS NULL
      OR concat_ws(
        ' ',
        target.collaborator_name,
        target.assigned_role,
        target.role_name,
        target.room,
        target.building,
        target.floor
      ) ILIKE '%' || v_query || '%'
    )
  ORDER BY target.collaborator_name
  LIMIT 1000;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_search_external(
  p_event_id uuid,
  p_session_token text,
  p_search text
) RETURNS TABLE (id uuid, nome text, cargo text, campus text, building text, floor text, room text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
  v_query text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'subcoordinator' OR length(v_query) < 3 THEN RETURN; END IF;
  SELECT id INTO v_evaluator_link_id FROM public.ps_event_collaborators WHERE event_id = p_event_id AND collaborator_id = v_session.collaborator_id ORDER BY created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT target.id, target.collaborator_name, coalesce(target.role_name, target.assigned_role), target.campus, target.building, target.floor, target.room
  FROM public.ps_event_collaborators target
  WHERE target.event_id = p_event_id
    AND target.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND concat_ws(' ', target.collaborator_name, target.role_name, target.assigned_role, target.campus, target.building, target.floor, target.room) ILIKE '%' || v_query || '%'
    AND NOT public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
    AND NOT EXISTS (SELECT 1 FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.collaborator_id = target.collaborator_id AND e.evaluation_level = 'subcoordinator')
  ORDER BY target.collaborator_name LIMIT 30;
END;
$$;
