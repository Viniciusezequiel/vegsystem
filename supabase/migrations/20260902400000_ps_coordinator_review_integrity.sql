-- Integridade da revisão de avaliações.
--
-- O coordenador pode visualizar e retificar exclusivamente
-- avaliações realizadas pelos subcoordenadores.
--
-- A classificação final nunca é aceita do cliente:
-- ela é sempre derivada da média dos nove critérios.

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluations(
  p_event_id uuid,
  p_session_token text,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all'
) RETURNS TABLE (
  evaluation_id uuid,
  review_id uuid,
  collaborator_name text,
  assigned_role text,
  campus text,
  building text,
  floor text,
  room text,
  evaluator_name text,
  evaluation_level text,
  punctuality integer,
  domain integer,
  room_control integer,
  attention_vigilance integer,
  professional_posture integer,
  communication integer,
  organization integer,
  incident_management integer,
  teamwork integer,
  final_score numeric,
  classification text,
  observations text,
  evaluated_at timestamptz,
  review_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_query text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;
  IF p_status NOT IN ('all', 'subcoordinators', 'pending', 'rectified') THEN RETURN; END IF;

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
    AND e.evaluation_level = 'subcoordinator'
    AND (v_query IS NULL OR concat_ws(' ', e.collaborator_name, e.assigned_role, link.campus, link.building, link.floor, link.room) ILIKE '%' || v_query || '%')
    AND (p_status = 'all'
      OR (p_status = 'subcoordinators')
      OR (p_status = 'pending' AND (review.id IS NULL OR review.status = 'correction_requested'))
      OR (p_status = 'rectified' AND review.status = 'corrected'))
  ORDER BY e.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_dashboard(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE (
  total_fiscais_avaliados integer,
  total_avaliacoes integer,
  media_geral numeric,
  pendencias integer,
  retificacoes integer,
  subcoordinator_name text,
  subcoordinator_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    (SELECT count(DISTINCT e.collaborator_id)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator'),
    (SELECT count(*)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator'),
    coalesce((SELECT round(avg(e.final_score), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator'), 0),
    (SELECT count(*)::integer FROM public.ps_evaluations e LEFT JOIN public.ps_evaluation_reviews r ON r.evaluation_id = e.id WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator' AND (r.id IS NULL OR r.status = 'correction_requested')),
    (SELECT count(*)::integer FROM public.ps_evaluation_rectifications r JOIN public.ps_evaluation_reviews review ON review.id = r.review_id WHERE review.event_id = p_event_id),
    e.evaluator_name,
    count(*)::integer
  FROM public.ps_evaluations e
  WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator'
  GROUP BY e.evaluator_name
  ORDER BY e.evaluator_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_request_rectification(
  p_event_id uuid,
  p_session_token text,
  p_evaluation_id uuid,
  p_justification text,
  p_new_data jsonb
) RETURNS TABLE (success boolean, message text, rectification_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_evaluation public.ps_evaluations%ROWTYPE;
  v_review public.ps_evaluation_reviews%ROWTYPE;
  v_old_data jsonb;
  v_new_data jsonb;
  v_criteria jsonb;
  v_score numeric;
  v_classification text;
  v_rectification_id uuid;
  v_key text;
  v_value integer;
BEGIN
  SELECT * INTO v_session FROM public.ps_validate_evaluator_session(p_event_id, p_session_token) WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN
    RETURN QUERY SELECT false, 'Sessão sem permissão para revisar avaliações.', NULL::uuid;
    RETURN;
  END IF;
  IF nullif(trim(p_justification), '') IS NULL OR p_new_data IS NULL OR jsonb_typeof(p_new_data) <> 'object' THEN
    RETURN QUERY SELECT false, 'Justificativa e alterações propostas são obrigatórias.', NULL::uuid;
    RETURN;
  END IF;
  IF p_new_data ?| ARRAY['event_id','collaborator_id','evaluator_event_collaborator_id','evaluator_name','evaluator_role','created_at','evaluation_level'] THEN
    RETURN QUERY SELECT false, 'Os dados imutáveis da avaliação não podem ser alterados.', NULL::uuid;
    RETURN;
  END IF;
  SELECT * INTO v_evaluation FROM public.ps_evaluations WHERE id = p_evaluation_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'Avaliação não encontrada.', NULL::uuid;
    RETURN;
  END IF;

  IF v_evaluation.evaluation_level <> 'subcoordinator' THEN
    RETURN QUERY
    SELECT
      false,
      'Somente avaliações realizadas por subcoordenadores podem ser retificadas.',
      NULL::uuid;
    RETURN;
  END IF;

  v_criteria := coalesce(p_new_data -> 'criteria', '{}'::jsonb);
  IF jsonb_typeof(v_criteria) <> 'object' THEN
    RETURN QUERY SELECT false, 'Critérios inválidos.', NULL::uuid;
    RETURN;
  END IF;
  FOREACH v_key IN ARRAY ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'] LOOP
    IF v_criteria ? v_key THEN
      IF jsonb_typeof(v_criteria -> v_key) <> 'number' OR (v_criteria ->> v_key) !~ '^[1-5]$' THEN
        RETURN QUERY SELECT false, 'Cada critério deve receber uma nota inteira de 1 a 5.', NULL::uuid;
        RETURN;
      END IF;
    END IF;
  END LOOP;
  v_score := 0;
  v_score := v_score + coalesce((v_criteria ->> 'punctuality')::integer, v_evaluation.punctuality);
  v_score := v_score + coalesce((v_criteria ->> 'domain')::integer, v_evaluation.domain);
  v_score := v_score + coalesce((v_criteria ->> 'room_control')::integer, v_evaluation.room_control);
  v_score := v_score + coalesce((v_criteria ->> 'attention_vigilance')::integer, v_evaluation.attention_vigilance);
  v_score := v_score + coalesce((v_criteria ->> 'professional_posture')::integer, v_evaluation.professional_posture);
  v_score := v_score + coalesce((v_criteria ->> 'communication')::integer, v_evaluation.communication);
  v_score := v_score + coalesce((v_criteria ->> 'organization')::integer, v_evaluation.organization);
  v_score := v_score + coalesce((v_criteria ->> 'incident_management')::integer, v_evaluation.incident_management);
  v_score := v_score + coalesce((v_criteria ->> 'teamwork')::integer, v_evaluation.teamwork);
  v_score := round(v_score / 9, 2);
  v_classification := CASE WHEN v_score >= 4.5 THEN 'excelente' WHEN v_score >= 3.5 THEN 'bom' WHEN v_score >= 2.5 THEN 'regular' WHEN v_score >= 1.5 THEN 'insuficiente' ELSE 'critico' END;
  v_old_data := jsonb_build_object('criteria', jsonb_build_object('punctuality', v_evaluation.punctuality, 'domain', v_evaluation.domain, 'room_control', v_evaluation.room_control, 'attention_vigilance', v_evaluation.attention_vigilance, 'professional_posture', v_evaluation.professional_posture, 'communication', v_evaluation.communication, 'organization', v_evaluation.organization, 'incident_management', v_evaluation.incident_management, 'teamwork', v_evaluation.teamwork), 'final_score', v_evaluation.final_score, 'classification', v_evaluation.classification, 'observations', v_evaluation.observations);
  v_new_data := jsonb_build_object('criteria', jsonb_build_object('punctuality', coalesce((v_criteria ->> 'punctuality')::integer, v_evaluation.punctuality), 'domain', coalesce((v_criteria ->> 'domain')::integer, v_evaluation.domain), 'room_control', coalesce((v_criteria ->> 'room_control')::integer, v_evaluation.room_control), 'attention_vigilance', coalesce((v_criteria ->> 'attention_vigilance')::integer, v_evaluation.attention_vigilance), 'professional_posture', coalesce((v_criteria ->> 'professional_posture')::integer, v_evaluation.professional_posture), 'communication', coalesce((v_criteria ->> 'communication')::integer, v_evaluation.communication), 'organization', coalesce((v_criteria ->> 'organization')::integer, v_evaluation.organization), 'incident_management', coalesce((v_criteria ->> 'incident_management')::integer, v_evaluation.incident_management), 'teamwork', coalesce((v_criteria ->> 'teamwork')::integer, v_evaluation.teamwork)), 'final_score', v_score, 'classification', v_classification, 'observations', CASE WHEN p_new_data ? 'observations' THEN p_new_data ->> 'observations' ELSE v_evaluation.observations END);

  SELECT * INTO v_review FROM public.ps_evaluation_reviews WHERE evaluation_id = v_evaluation.id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.ps_evaluation_reviews (event_id, evaluation_id, reviewer_account_id, reviewer_collaborator_id, status, justification)
    VALUES (p_event_id, v_evaluation.id, v_session.account_id, v_session.collaborator_id, 'correction_requested', trim(p_justification))
    RETURNING * INTO v_review;
  ELSE
    UPDATE public.ps_evaluation_reviews SET status = 'correction_requested', justification = trim(p_justification), updated_at = now() WHERE id = v_review.id;
  END IF;
  INSERT INTO public.ps_evaluation_rectifications (review_id, evaluation_id, old_data, new_data, reason, created_by)
  VALUES (v_review.id, v_evaluation.id, v_old_data, v_new_data, trim(p_justification), v_session.account_id)
  RETURNING id INTO v_rectification_id;
  UPDATE public.ps_evaluations SET
    punctuality = coalesce((v_criteria ->> 'punctuality')::integer, punctuality), domain = coalesce((v_criteria ->> 'domain')::integer, domain), room_control = coalesce((v_criteria ->> 'room_control')::integer, room_control), attention_vigilance = coalesce((v_criteria ->> 'attention_vigilance')::integer, attention_vigilance), professional_posture = coalesce((v_criteria ->> 'professional_posture')::integer, professional_posture), communication = coalesce((v_criteria ->> 'communication')::integer, communication), organization = coalesce((v_criteria ->> 'organization')::integer, organization), incident_management = coalesce((v_criteria ->> 'incident_management')::integer, incident_management), teamwork = coalesce((v_criteria ->> 'teamwork')::integer, teamwork), final_score = v_score, classification = v_classification, observations = CASE WHEN p_new_data ? 'observations' THEN p_new_data ->> 'observations' ELSE observations END
  WHERE id = v_evaluation.id;
  UPDATE public.ps_evaluation_reviews SET status = 'corrected', updated_at = now() WHERE id = v_review.id;
  RETURN QUERY SELECT true, 'Retificação registrada com sucesso.', v_rectification_id;
END;
$$;


REVOKE ALL ON FUNCTION
public.ps_public_coordinator_evaluations(uuid, text, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
public.ps_public_coordinator_dashboard(uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
public.ps_public_coordinator_request_rectification(
  uuid,
  text,
  uuid,
  text,
  jsonb
)
FROM PUBLIC, anon, authenticated;


GRANT EXECUTE ON FUNCTION
public.ps_public_coordinator_evaluations(uuid, text, text, text)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.ps_public_coordinator_dashboard(uuid, text)
TO anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.ps_public_coordinator_request_rectification(
  uuid,
  text,
  uuid,
  text,
  jsonb
)
TO anon, authenticated;
