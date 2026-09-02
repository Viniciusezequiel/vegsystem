CREATE TABLE IF NOT EXISTS public.ps_evaluation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL REFERENCES public.ps_evaluations(id) ON DELETE CASCADE,
  reviewer_account_id uuid NOT NULL REFERENCES public.ps_evaluator_accounts(id) ON DELETE RESTRICT,
  reviewer_collaborator_id uuid NOT NULL REFERENCES public.ps_collaborators(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'correction_requested',
  justification text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_evaluation_reviews_status_check
    CHECK (status IN ('approved', 'correction_requested', 'corrected')),
  CONSTRAINT ps_evaluation_reviews_justification_check
    CHECK (nullif(trim(justification), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluation_reviews_evaluation_unique
  ON public.ps_evaluation_reviews (evaluation_id);
CREATE INDEX IF NOT EXISTS ps_evaluation_reviews_event_status_idx
  ON public.ps_evaluation_reviews (event_id, status);
CREATE INDEX IF NOT EXISTS ps_evaluation_reviews_reviewer_idx
  ON public.ps_evaluation_reviews (reviewer_account_id);

CREATE TABLE IF NOT EXISTS public.ps_evaluation_rectifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.ps_evaluation_reviews(id) ON DELETE RESTRICT,
  evaluation_id uuid NOT NULL REFERENCES public.ps_evaluations(id) ON DELETE RESTRICT,
  old_data jsonb NOT NULL,
  new_data jsonb NOT NULL,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.ps_evaluator_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_evaluation_rectifications_reason_check
    CHECK (nullif(trim(reason), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ps_evaluation_rectifications_review_idx
  ON public.ps_evaluation_rectifications (review_id, created_at);
CREATE INDEX IF NOT EXISTS ps_evaluation_rectifications_evaluation_idx
  ON public.ps_evaluation_rectifications (evaluation_id, created_at);

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
    AND e.evaluation_level IN ('subcoordinator', 'coordination')
    AND (v_query IS NULL OR concat_ws(' ', e.collaborator_name, e.assigned_role, link.campus, link.building, link.floor, link.room) ILIKE '%' || v_query || '%')
    AND (p_status = 'all'
      OR (p_status = 'subcoordinators' AND e.evaluation_level = 'subcoordinator')
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
    (SELECT count(DISTINCT e.collaborator_id)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level IN ('subcoordinator', 'coordination')),
    (SELECT count(*)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level IN ('subcoordinator', 'coordination')),
    coalesce((SELECT round(avg(e.final_score), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level IN ('subcoordinator', 'coordination')), 0),
    (SELECT count(*)::integer FROM public.ps_evaluations e LEFT JOIN public.ps_evaluation_reviews r ON r.evaluation_id = e.id WHERE e.event_id = p_event_id AND e.evaluation_level IN ('subcoordinator', 'coordination') AND (r.id IS NULL OR r.status = 'correction_requested')),
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
  IF NOT FOUND OR v_evaluation.evaluation_level NOT IN ('subcoordinator', 'coordination') THEN
    RETURN QUERY SELECT false, 'Avaliação não encontrada.', NULL::uuid;
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
  v_new_data := jsonb_build_object('criteria', jsonb_build_object('punctuality', coalesce((v_criteria ->> 'punctuality')::integer, v_evaluation.punctuality), 'domain', coalesce((v_criteria ->> 'domain')::integer, v_evaluation.domain), 'room_control', coalesce((v_criteria ->> 'room_control')::integer, v_evaluation.room_control), 'attention_vigilance', coalesce((v_criteria ->> 'attention_vigilance')::integer, v_evaluation.attention_vigilance), 'professional_posture', coalesce((v_criteria ->> 'professional_posture')::integer, v_evaluation.professional_posture), 'communication', coalesce((v_criteria ->> 'communication')::integer, v_evaluation.communication), 'organization', coalesce((v_criteria ->> 'organization')::integer, v_evaluation.organization), 'incident_management', coalesce((v_criteria ->> 'incident_management')::integer, v_evaluation.incident_management), 'teamwork', coalesce((v_criteria ->> 'teamwork')::integer, v_evaluation.teamwork)), 'final_score', v_score, 'classification', coalesce(nullif(trim(p_new_data ->> 'classification'), ''), v_classification), 'observations', CASE WHEN p_new_data ? 'observations' THEN p_new_data ->> 'observations' ELSE v_evaluation.observations END);

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
    punctuality = coalesce((v_criteria ->> 'punctuality')::integer, punctuality), domain = coalesce((v_criteria ->> 'domain')::integer, domain), room_control = coalesce((v_criteria ->> 'room_control')::integer, room_control), attention_vigilance = coalesce((v_criteria ->> 'attention_vigilance')::integer, attention_vigilance), professional_posture = coalesce((v_criteria ->> 'professional_posture')::integer, professional_posture), communication = coalesce((v_criteria ->> 'communication')::integer, communication), organization = coalesce((v_criteria ->> 'organization')::integer, organization), incident_management = coalesce((v_criteria ->> 'incident_management')::integer, incident_management), teamwork = coalesce((v_criteria ->> 'teamwork')::integer, teamwork), final_score = v_score, classification = coalesce(nullif(trim(p_new_data ->> 'classification'), ''), v_classification), observations = CASE WHEN p_new_data ? 'observations' THEN p_new_data ->> 'observations' ELSE observations END
  WHERE id = v_evaluation.id;
  UPDATE public.ps_evaluation_reviews SET status = 'corrected', updated_at = now() WHERE id = v_review.id;
  RETURN QUERY SELECT true, 'Retificação registrada com sucesso.', v_rectification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_coordinator_evaluations(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_coordinator_dashboard(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_coordinator_request_rectification(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_coordinator_evaluations(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_coordinator_dashboard(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_coordinator_request_rectification(uuid, text, uuid, text, jsonb) TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluation_reviews TO authenticated;
GRANT SELECT ON public.ps_evaluation_rectifications TO authenticated;
GRANT ALL ON public.ps_evaluation_reviews TO service_role;
GRANT ALL ON public.ps_evaluation_rectifications TO service_role;
ALTER TABLE public.ps_evaluation_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_evaluation_rectifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evaluation_reviews internal manage" ON public.ps_evaluation_reviews FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evaluation_rectifications internal read" ON public.ps_evaluation_rectifications FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS ps_evaluation_reviews_updated ON public.ps_evaluation_reviews;
CREATE TRIGGER ps_evaluation_reviews_updated BEFORE UPDATE ON public.ps_evaluation_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluation_history(
  p_event_id uuid,
  p_session_token text,
  p_evaluation_id uuid
) RETURNS TABLE (kind text, reason text, created_at timestamptz, old_data jsonb, new_data jsonb)
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
  SELECT 'evaluation'::text, NULL::text, e.created_at, NULL::jsonb, NULL::jsonb
  FROM public.ps_evaluations e
  WHERE e.id = p_evaluation_id AND e.event_id = p_event_id
  UNION ALL
  SELECT 'rectification'::text, r.reason, r.created_at, r.old_data, r.new_data
  FROM public.ps_evaluation_rectifications r
  JOIN public.ps_evaluation_reviews review ON review.id = r.review_id
  WHERE r.evaluation_id = p_evaluation_id AND review.event_id = p_event_id
  ORDER BY created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_coordinator_evaluation_history(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_coordinator_evaluation_history(uuid, text, uuid) TO anon, authenticated;