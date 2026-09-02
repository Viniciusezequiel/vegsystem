CREATE OR REPLACE FUNCTION public.ps_evaluator_role_for_assignment(
  p_role_value text,
  p_assigned_role text,
  p_role_name text
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT lower(r.value || ' ' || r.name) INTO v_role
  FROM public.ps_roles r
  WHERE lower(r.value) IN (lower(trim(coalesce(p_role_value, ''))), lower(trim(coalesce(p_assigned_role, ''))), lower(trim(coalesce(p_role_name, ''))))
     OR lower(r.name) IN (lower(trim(coalesce(p_role_value, ''))), lower(trim(coalesce(p_assigned_role, ''))), lower(trim(coalesce(p_role_name, ''))))
  ORDER BY r.active DESC
  LIMIT 1;
  v_role := lower(coalesce(v_role, coalesce(p_role_value, '') || ' ' || coalesce(p_assigned_role, '') || ' ' || coalesce(p_role_name, '')));
  IF v_role LIKE '%sub%coord%' OR v_role LIKE '%subcoord%' THEN RETURN 'subcoordinator'; END IF;
  IF v_role LIKE '%coord%' THEN RETURN 'coordinator'; END IF;
  RETURN NULL;
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
      AND coalesce(target.participation_status, '') <> 'replaced'
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
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password THEN RETURN; END IF;
  v_level := CASE WHEN v_session.role = 'coordinator' THEN 'coordination' ELSE 'subcoordinator' END;
  SELECT id INTO v_evaluator_link_id FROM public.ps_event_collaborators
  WHERE event_id = p_event_id AND collaborator_id = v_session.collaborator_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT target.id, target.collaborator_id, target.collaborator_name, target.assigned_role,
    target.role_name, target.campus, target.building, target.floor, target.room, target.unit, target.sector
  FROM public.ps_event_collaborators target
  WHERE target.event_id = p_event_id
    AND public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.ps_evaluations evaluation
      WHERE evaluation.event_id = p_event_id
        AND evaluation.collaborator_id = target.collaborator_id
        AND evaluation.evaluation_level = v_level
    )
    AND (v_query IS NULL OR concat_ws(' ', target.collaborator_name, target.assigned_role, target.role_name, target.room, target.building, target.floor) ILIKE '%' || v_query || '%')
  ORDER BY target.collaborator_name
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_dashboard(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE (pending_count integer, completed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
  v_level text;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password THEN RETURN QUERY SELECT 0, 0; RETURN; END IF;
  v_level := CASE WHEN v_session.role = 'coordinator' THEN 'coordination' ELSE 'subcoordinator' END;
  SELECT id INTO v_evaluator_link_id FROM public.ps_event_collaborators
  WHERE event_id = p_event_id AND collaborator_id = v_session.collaborator_id
  ORDER BY created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN QUERY SELECT 0, 0; RETURN; END IF;
  RETURN QUERY SELECT
    (SELECT count(*)::integer FROM public.ps_event_collaborators target
     WHERE target.event_id = p_event_id
       AND public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
       AND NOT EXISTS (SELECT 1 FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.collaborator_id = target.collaborator_id AND e.evaluation_level = v_level)),
    (SELECT count(*)::integer FROM public.ps_evaluations e
     WHERE e.event_id = p_event_id AND e.evaluator_event_collaborator_id = v_evaluator_link_id AND e.evaluation_level = v_level);
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
    AND concat_ws(' ', target.collaborator_name, target.role_name, target.assigned_role, target.campus, target.building, target.floor, target.room) ILIKE '%' || v_query || '%'
    AND NOT public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
    AND NOT EXISTS (SELECT 1 FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.collaborator_id = target.collaborator_id AND e.evaluation_level = 'subcoordinator')
  ORDER BY target.collaborator_name LIMIT 30;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_add_override(
  p_event_id uuid,
  p_session_token text,
  p_event_collaborator_id uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'subcoordinator' THEN RETURN false; END IF;
  SELECT id INTO v_evaluator_link_id FROM public.ps_event_collaborators WHERE event_id = p_event_id AND collaborator_id = v_session.collaborator_id ORDER BY created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.ps_event_collaborators WHERE id = p_event_collaborator_id AND event_id = p_event_id) THEN RETURN false; END IF;
  IF public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, p_event_collaborator_id) THEN RETURN true; END IF;
  INSERT INTO public.ps_evaluation_scope_overrides (event_id, evaluator_event_collaborator_id, event_collaborator_id, reason)
  VALUES (p_event_id, v_evaluator_link_id, p_event_collaborator_id, nullif(trim(p_reason), ''))
  ON CONFLICT (event_id, evaluator_event_collaborator_id, event_collaborator_id) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_submit_evaluation(
  p_event_id uuid,
  p_session_token text,
  p_event_collaborator_id uuid,
  p_criteria jsonb,
  p_observations text DEFAULT NULL,
  p_role_changed boolean DEFAULT false,
  p_reported_role text DEFAULT NULL,
  p_role_change_justification text DEFAULT NULL
) RETURNS TABLE (success boolean, message text, evaluation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link public.ps_event_collaborators%ROWTYPE;
  v_target public.ps_event_collaborators%ROWTYPE;
  v_level text;
  v_score numeric;
  v_classification text;
  v_id uuid;
  v_key text;
  v_value integer;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password THEN RETURN QUERY SELECT false, 'Sessão inválida ou alteração de senha obrigatória.', NULL::uuid; RETURN; END IF;
  SELECT * INTO v_evaluator_link FROM public.ps_event_collaborators WHERE event_id = p_event_id AND collaborator_id = v_session.collaborator_id ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_target FROM public.ps_event_collaborators WHERE id = p_event_collaborator_id AND event_id = p_event_id;
  IF NOT FOUND OR NOT public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link.id, v_session.role, p_event_collaborator_id) THEN RETURN QUERY SELECT false, 'Fiscal não está disponível para este avaliador.', NULL::uuid; RETURN; END IF;
  v_level := CASE WHEN v_session.role = 'coordinator' THEN 'coordination' ELSE 'subcoordinator' END;

  FOREACH v_key IN ARRAY ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'] LOOP
    IF jsonb_typeof(p_criteria -> v_key) <> 'number' OR (p_criteria ->> v_key) !~ '^[1-5]$' THEN
      RETURN QUERY SELECT false, 'Todos os critérios devem receber uma nota de 1 a 5.', NULL::uuid;
      RETURN;
    END IF;
    v_value := (p_criteria ->> v_key)::integer;
    v_score := coalesce(v_score, 0) + v_value;
  END LOOP;
  IF p_role_changed AND (nullif(trim(p_reported_role), '') IS NULL OR nullif(trim(p_role_change_justification), '') IS NULL) THEN RETURN QUERY SELECT false, 'Informe o cargo exercido e a justificativa.', NULL::uuid; RETURN; END IF;
  v_score := round(v_score / 9, 2);
  v_classification := CASE WHEN v_score >= 4.5 THEN 'excelente' WHEN v_score >= 3.5 THEN 'bom' WHEN v_score >= 2.5 THEN 'regular' WHEN v_score >= 1.5 THEN 'insuficiente' ELSE 'critico' END;

  INSERT INTO public.ps_evaluations (
    event_id, collaborator_id, collaborator_name, assigned_role, evaluation_level,
    evaluator_event_collaborator_id, evaluator_name, evaluator_role,
    evaluator_campus, evaluator_building, evaluator_floor,
    punctuality, domain, room_control, attention_vigilance, professional_posture,
    communication, organization, incident_management, teamwork, final_score,
    classification, observations, role_changed, original_role, reported_role, role_change_justification
  ) VALUES (
    p_event_id, v_target.collaborator_id, v_target.collaborator_name,
    coalesce(v_target.assigned_role, v_target.role_name, ''), v_level,
    v_evaluator_link.id, v_session.evaluator_name, v_session.role,
    v_evaluator_link.campus, v_evaluator_link.building, v_evaluator_link.floor,
    (p_criteria ->> 'punctuality')::integer, (p_criteria ->> 'domain')::integer,
    (p_criteria ->> 'room_control')::integer, (p_criteria ->> 'attention_vigilance')::integer,
    (p_criteria ->> 'professional_posture')::integer, (p_criteria ->> 'communication')::integer,
    (p_criteria ->> 'organization')::integer, (p_criteria ->> 'incident_management')::integer,
    (p_criteria ->> 'teamwork')::integer, v_score, v_classification, nullif(trim(p_observations), ''),
    coalesce(p_role_changed, false), coalesce(v_target.assigned_role, v_target.role_name),
    nullif(trim(p_reported_role), ''), nullif(trim(p_role_change_justification), '')
  ) ON CONFLICT (event_id, collaborator_id, evaluation_level) WHERE collaborator_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN QUERY SELECT false, 'Este fiscal já foi avaliado neste nível.', NULL::uuid; RETURN; END IF;

  IF p_role_changed THEN
    INSERT INTO public.ps_event_collaborator_adjustments (
      event_id, event_collaborator_id, adjustment_type, source, old_value, new_value,
      justification, reported_by_event_collaborator_id, reported_by_name, status
    ) VALUES (
      p_event_id, v_target.id, 'role', 'evaluation',
      coalesce(v_target.assigned_role, v_target.role_name, ''), trim(p_reported_role),
      trim(p_role_change_justification), v_evaluator_link.id, v_session.evaluator_name, 'pending'
    );
  END IF;
  UPDATE public.ps_event_collaborators SET evaluated = true WHERE id = v_target.id;
  RETURN QUERY SELECT true, 'Avaliação registrada com sucesso.', v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_evaluator_role_for_assignment(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_evaluator_link_can_access(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_queue(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_dashboard(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_search_external(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_add_override(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_submit_evaluation(uuid, text, uuid, jsonb, text, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_queue(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_dashboard(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_search_external(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_add_override(uuid, text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_submit_evaluation(uuid, text, uuid, jsonb, text, boolean, text, text) TO anon, authenticated;