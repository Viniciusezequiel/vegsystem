-- Shared evaluation queue: one evaluation per fiscal/event.
-- Evaluator privacy: public evaluator sessions can only read their own evaluations.
-- Administrative/internal access remains governed by ps_evaluations RLS.

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluations_event_collaborator_unique
ON public.ps_evaluations(event_id, collaborator_id)
WHERE collaborator_id IS NOT NULL;

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
  v_query text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND OR v_session.must_change_password THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = v_session.role
  ORDER BY ec.created_at DESC
  LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT target.id, target.collaborator_id, target.collaborator_name,
         target.assigned_role, target.role_name, target.campus,
         target.building, target.floor, target.room, target.unit, target.sector
  FROM public.ps_event_collaborators target
  WHERE target.event_id = p_event_id
    AND public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.ps_evaluations e
      WHERE e.event_id = p_event_id
        AND e.collaborator_id = target.collaborator_id
    )
    AND (
      v_query IS NULL OR
      concat_ws(' ', target.collaborator_name, target.assigned_role, target.role_name,
                target.room, target.building, target.floor) ILIKE '%' || v_query || '%'
    )
  ORDER BY target.collaborator_name
  LIMIT 1000;
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
BEGIN
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND OR v_session.must_change_password THEN
    RETURN QUERY SELECT 0, 0; RETURN;
  END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = v_session.role
  ORDER BY ec.created_at DESC
  LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN
    RETURN QUERY SELECT 0, 0; RETURN;
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*)::integer
     FROM public.ps_event_collaborators target
     WHERE target.event_id = p_event_id
       AND public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.ps_evaluations e
         WHERE e.event_id = p_event_id
           AND e.collaborator_id = target.collaborator_id
       )),
    (SELECT count(*)::integer
     FROM public.ps_evaluations e
     WHERE e.event_id = p_event_id
       AND e.evaluator_event_collaborator_id = v_evaluator_link_id);
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
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'subcoordinator' OR length(v_query) < 3 THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = v_session.role
  ORDER BY ec.created_at DESC
  LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT target.id, target.collaborator_name, coalesce(target.role_name, target.assigned_role),
         target.campus, target.building, target.floor, target.room
  FROM public.ps_event_collaborators target
  WHERE target.event_id = p_event_id
    AND target.participation_status IN ('pending_confirmation','confirmed')
    AND coalesce(target.absent, false) = false
    AND target.collaborator_id IS NOT NULL
    AND public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) IS NULL
    AND EXISTS (
      SELECT 1 FROM public.ps_collaborators c
      WHERE c.id = target.collaborator_id AND coalesce(c.active, true)
    )
    AND concat_ws(' ', target.collaborator_name, target.role_name, target.assigned_role,
                  target.campus, target.building, target.floor, target.room) ILIKE '%' || v_query || '%'
    AND NOT public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, target.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.ps_evaluations e
      WHERE e.event_id = p_event_id
        AND e.collaborator_id = target.collaborator_id
    )
  ORDER BY target.collaborator_name
  LIMIT 30;
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
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'subcoordinator' THEN RETURN false; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = v_session.role
  ORDER BY ec.created_at DESC
  LIMIT 1;

  IF v_evaluator_link_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.ps_event_collaborators target
    WHERE target.id = p_event_collaborator_id
      AND target.event_id = p_event_id
      AND target.participation_status IN ('pending_confirmation','confirmed')
      AND coalesce(target.absent, false) = false
      AND target.collaborator_id IS NOT NULL
      AND public.ps_evaluator_role_for_assignment(target.role_value, target.assigned_role, target.role_name) IS NULL
      AND EXISTS (
        SELECT 1 FROM public.ps_collaborators c
        WHERE c.id = target.collaborator_id AND coalesce(c.active, true)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ps_evaluations e
        WHERE e.event_id = p_event_id
          AND e.collaborator_id = target.collaborator_id
      )
  ) THEN
    RETURN false;
  END IF;

  IF public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link_id, v_session.role, p_event_collaborator_id) THEN
    RETURN true;
  END IF;

  INSERT INTO public.ps_evaluation_scope_overrides(event_id, evaluator_event_collaborator_id, event_collaborator_id, reason)
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
  IF NOT FOUND OR v_session.must_change_password THEN
    RETURN QUERY SELECT false, 'Sessão inválida ou alteração de senha obrigatória.', NULL::uuid; RETURN;
  END IF;

  SELECT ec.* INTO v_evaluator_link
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = v_session.role
  ORDER BY ec.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Avaliador não pertence mais à equipe ativa deste evento.', NULL::uuid; RETURN;
  END IF;

  SELECT * INTO v_target
  FROM public.ps_event_collaborators
  WHERE id = p_event_collaborator_id AND event_id = p_event_id;

  IF NOT FOUND OR NOT public.ps_evaluator_link_can_access(p_event_id, v_evaluator_link.id, v_session.role, p_event_collaborator_id) THEN
    RETURN QUERY SELECT false, 'Fiscal não está disponível para este avaliador.', NULL::uuid; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ps_evaluations e
    WHERE e.event_id = p_event_id
      AND e.collaborator_id = v_target.collaborator_id
  ) THEN
    RETURN QUERY SELECT false, 'Este fiscal já foi avaliado por outro integrante da equipe.', NULL::uuid; RETURN;
  END IF;

  v_level := CASE WHEN v_session.role = 'coordinator' THEN 'coordination' ELSE 'subcoordinator' END;

  FOREACH v_key IN ARRAY ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'] LOOP
    IF jsonb_typeof(p_criteria -> v_key) <> 'number' OR (p_criteria ->> v_key) !~ '^[1-5]$' THEN
      RETURN QUERY SELECT false, 'Todos os critérios devem receber uma nota de 1 a 5.', NULL::uuid; RETURN;
    END IF;
    v_value := (p_criteria ->> v_key)::integer;
    v_score := coalesce(v_score, 0) + v_value;
  END LOOP;

  IF p_role_changed AND (nullif(trim(p_reported_role), '') IS NULL OR nullif(trim(p_role_change_justification), '') IS NULL) THEN
    RETURN QUERY SELECT false, 'Informe o cargo exercido e a justificativa.', NULL::uuid; RETURN;
  END IF;

  v_score := round(v_score / 9, 2);
  v_classification := CASE
    WHEN v_score >= 4.5 THEN 'excelente'
    WHEN v_score >= 3.5 THEN 'bom'
    WHEN v_score >= 2.5 THEN 'regular'
    WHEN v_score >= 1.5 THEN 'insuficiente'
    ELSE 'critico'
  END;

  INSERT INTO public.ps_evaluations(
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
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, 'Este fiscal já foi avaliado por outro integrante da equipe.', NULL::uuid; RETURN;
  END IF;

  IF p_role_changed THEN
    INSERT INTO public.ps_event_collaborator_adjustments(
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

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluations(
  p_event_id uuid,
  p_session_token text,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all'
) RETURNS TABLE(
  evaluation_id uuid, review_id uuid, collaborator_name text, assigned_role text,
  campus text, building text, floor text, room text, evaluator_name text, evaluation_level text,
  punctuality integer, domain integer, room_control integer, attention_vigilance integer,
  professional_posture integer, communication integer, organization integer,
  incident_management integer, teamwork integer, final_score numeric, classification text,
  observations text, evaluated_at timestamptz, review_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_query text := nullif(trim(coalesce(p_search, '')), '');
  v_evaluator_link_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = 'coordinator'
  ORDER BY ec.created_at DESC
  LIMIT 1;

  IF v_evaluator_link_id IS NULL OR p_status NOT IN ('all','subcoordinators','pending','rectified') THEN RETURN; END IF;

  RETURN QUERY
  SELECT e.id, review.id, e.collaborator_name, e.assigned_role,
         link.campus, link.building, link.floor, link.room,
         e.evaluator_name, e.evaluation_level, e.punctuality, e.domain, e.room_control,
         e.attention_vigilance, e.professional_posture, e.communication, e.organization,
         e.incident_management, e.teamwork, e.final_score, e.classification, e.observations,
         e.created_at, review.status
  FROM public.ps_evaluations e
  LEFT JOIN public.ps_evaluation_reviews review ON review.evaluation_id = e.id
  LEFT JOIN public.ps_event_collaborators link ON link.event_id = e.event_id AND link.collaborator_id = e.collaborator_id
  WHERE e.event_id = p_event_id
    AND e.evaluator_event_collaborator_id = v_evaluator_link_id
    AND (v_query IS NULL OR concat_ws(' ', e.collaborator_name, e.assigned_role, link.campus, link.building, link.floor, link.room) ILIKE '%' || v_query || '%')
  ORDER BY e.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluation_history(
  p_event_id uuid,
  p_session_token text,
  p_evaluation_id uuid
) RETURNS TABLE(kind text, reason text, created_at timestamptz, old_data jsonb, new_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = p_event_id
    AND ec.collaborator_id = v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value, ec.assigned_role, ec.role_name) = 'coordinator'
  ORDER BY ec.created_at DESC
  LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'evaluation'::text, NULL::text, e.created_at, NULL::jsonb, NULL::jsonb
  FROM public.ps_evaluations e
  WHERE e.id = p_evaluation_id
    AND e.event_id = p_event_id
    AND e.evaluator_event_collaborator_id = v_evaluator_link_id
  UNION ALL
  SELECT 'rectification'::text, r.reason, r.created_at, r.old_data, r.new_data
  FROM public.ps_evaluation_rectifications r
  JOIN public.ps_evaluation_reviews review ON review.id = r.review_id
  JOIN public.ps_evaluations e ON e.id = r.evaluation_id
  WHERE r.evaluation_id = p_evaluation_id
    AND review.event_id = p_event_id
    AND e.evaluator_event_collaborator_id = v_evaluator_link_id
  ORDER BY created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_request_rectification(
  p_event_id uuid,
  p_session_token text,
  p_evaluation_id uuid,
  p_justification text,
  p_new_data jsonb
) RETURNS TABLE(success boolean, message text, rectification_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id,p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN
    RETURN QUERY SELECT false,'Sessão sem permissão para revisar avaliações.',NULL::uuid; RETURN;
  END IF;

  RETURN QUERY
  SELECT false,
         'As avaliações são privadas entre avaliadores. Ajustes devem ser feitos pela administração do processo.',
         NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_dashboard(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE(
  total_fiscais_avaliados integer, total_avaliacoes integer, media_geral numeric,
  pendencias integer, retificacoes integer, subcoordinator_name text, subcoordinator_count integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id,p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id=p_event_id
    AND ec.collaborator_id=v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value,ec.assigned_role,ec.role_name)='coordinator'
  ORDER BY ec.created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT count(distinct e.collaborator_id)::integer,
         count(e.id)::integer,
         coalesce(round(avg(e.final_score),2),0),
         count(*) filter(where review.id is null or review.status='correction_requested')::integer,
         coalesce((select count(*)::integer
           from public.ps_evaluation_rectifications r
           join public.ps_evaluation_reviews rv on rv.id=r.review_id
           join public.ps_evaluations ev on ev.id=r.evaluation_id
           where rv.event_id=p_event_id and ev.evaluator_event_collaborator_id=v_evaluator_link_id),0),
         v_session.evaluator_name::text,
         count(e.id)::integer
  FROM public.ps_evaluations e
  LEFT JOIN public.ps_evaluation_reviews review ON review.evaluation_id=e.id
  WHERE e.event_id=p_event_id AND e.evaluator_event_collaborator_id=v_evaluator_link_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluation_dashboard(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE(
  total_fiscais_avaliados integer, total_avaliacoes integer, media_geral numeric,
  total_retificacoes integer, distribuicao jsonb, medias_criterios jsonb,
  desempenho_subcoordenadores jsonb, avaliacoes_abaixo_tres integer,
  fiscais_nota_baixa integer, alteracoes_cargo integer, avaliacoes_retificadas integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluator_link_id uuid;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id,p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;

  SELECT ec.id INTO v_evaluator_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id=p_event_id
    AND ec.collaborator_id=v_session.collaborator_id
    AND ec.participation_status IN ('pending_confirmation','confirmed')
    AND public.ps_evaluator_role_for_assignment(ec.role_value,ec.assigned_role,ec.role_name)='coordinator'
  ORDER BY ec.created_at DESC LIMIT 1;
  IF v_evaluator_link_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT count(distinct e.collaborator_id)::integer,
         count(e.id)::integer,
         coalesce(round(avg(e.final_score),2),0),
         coalesce((select count(*)::integer
           from public.ps_evaluation_rectifications r
           join public.ps_evaluation_reviews rv on rv.id=r.review_id
           join public.ps_evaluations ev on ev.id=r.evaluation_id
           where rv.event_id=p_event_id and ev.evaluator_event_collaborator_id=v_evaluator_link_id),0),
         coalesce((
           select jsonb_agg(jsonb_build_object('stars',s.stars,'count',coalesce(d.quantity,0)) order by s.stars desc)
           from generate_series(1,5) s(stars)
           left join (
             select floor(ev.final_score)::integer stars,count(*)::integer quantity
             from public.ps_evaluations ev
             where ev.event_id=p_event_id and ev.evaluator_event_collaborator_id=v_evaluator_link_id
             group by floor(ev.final_score)
           ) d using(stars)
         ),'[]'::jsonb),
         jsonb_build_array(
           jsonb_build_object('criterio','Pontualidade','media',coalesce(round(avg(e.punctuality),2),0)),
           jsonb_build_object('criterio','Domínio','media',coalesce(round(avg(e.domain),2),0)),
           jsonb_build_object('criterio','Controle de Sala','media',coalesce(round(avg(e.room_control),2),0)),
           jsonb_build_object('criterio','Atenção e Vigilância','media',coalesce(round(avg(e.attention_vigilance),2),0)),
           jsonb_build_object('criterio','Postura Profissional','media',coalesce(round(avg(e.professional_posture),2),0)),
           jsonb_build_object('criterio','Comunicação','media',coalesce(round(avg(e.communication),2),0)),
           jsonb_build_object('criterio','Organização','media',coalesce(round(avg(e.organization),2),0)),
           jsonb_build_object('criterio','Gestão de Ocorrências','media',coalesce(round(avg(e.incident_management),2),0)),
           jsonb_build_object('criterio','Trabalho em Equipe','media',coalesce(round(avg(e.teamwork),2),0))
         ),
         '[]'::jsonb,
         count(*) filter(where e.final_score<3)::integer,
         count(distinct e.collaborator_id) filter(where e.final_score<3)::integer,
         count(*) filter(where e.role_changed)::integer,
         coalesce((select count(distinct r.evaluation_id)::integer
           from public.ps_evaluation_rectifications r
           join public.ps_evaluation_reviews rv on rv.id=r.review_id
           join public.ps_evaluations ev on ev.id=r.evaluation_id
           where rv.event_id=p_event_id and ev.evaluator_event_collaborator_id=v_evaluator_link_id),0)
  FROM public.ps_evaluations e
  WHERE e.event_id=p_event_id AND e.evaluator_event_collaborator_id=v_evaluator_link_id;
END;
$$;
