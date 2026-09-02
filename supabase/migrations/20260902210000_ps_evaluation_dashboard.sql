CREATE OR REPLACE FUNCTION public.ps_public_coordinator_evaluation_dashboard(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE (
  total_fiscais_avaliados integer,
  total_avaliacoes integer,
  media_geral numeric,
  total_retificacoes integer,
  distribuicao jsonb,
  medias_criterios jsonb,
  desempenho_subcoordenadores jsonb,
  avaliacoes_abaixo_tres integer,
  fiscais_nota_baixa integer,
  alteracoes_cargo integer,
  avaliacoes_retificadas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session record;
  v_total integer;
  v_evaluations text[] := ARRAY['subcoordinator', 'coordination'];
BEGIN
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND OR v_session.must_change_password OR v_session.role <> 'coordinator' THEN RETURN; END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.ps_evaluations e
  WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations);

  RETURN QUERY
  SELECT
    (SELECT count(DISTINCT e.collaborator_id)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)),
    v_total,
    coalesce((SELECT round(avg(e.final_score), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0),
    (SELECT count(*)::integer FROM public.ps_evaluation_rectifications r JOIN public.ps_evaluation_reviews review ON review.id = r.review_id WHERE review.event_id = p_event_id),
    (SELECT jsonb_agg(jsonb_build_object('stars', stars, 'count', coalesce(distribution.quantity, 0)) ORDER BY stars DESC) FROM generate_series(1, 5) stars LEFT JOIN (SELECT floor(e.final_score)::integer stars, count(*)::integer quantity FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations) GROUP BY floor(e.final_score)) distribution USING (stars)),
    jsonb_build_array(
      jsonb_build_object('criterio', 'Pontualidade', 'media', coalesce((SELECT round(avg(e.punctuality), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Domínio', 'media', coalesce((SELECT round(avg(e.domain), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Controle de Sala', 'media', coalesce((SELECT round(avg(e.room_control), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Atenção e Vigilância', 'media', coalesce((SELECT round(avg(e.attention_vigilance), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Postura Profissional', 'media', coalesce((SELECT round(avg(e.professional_posture), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Comunicação', 'media', coalesce((SELECT round(avg(e.communication), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Organização', 'media', coalesce((SELECT round(avg(e.organization), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Gestão de Ocorrências', 'media', coalesce((SELECT round(avg(e.incident_management), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0)),
      jsonb_build_object('criterio', 'Trabalho em Equipe', 'media', coalesce((SELECT round(avg(e.teamwork), 2) FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations)), 0))
    ),
    coalesce((SELECT jsonb_agg(jsonb_build_object('subcoordinator_name', summary.evaluator_name, 'quantidade_avaliacoes', summary.quantity, 'media_das_avaliacoes', summary.average_score, 'total_retificacoes_relacionadas', summary.rectifications) ORDER BY summary.evaluator_name) FROM (SELECT e.evaluator_name, e.evaluator_event_collaborator_id, count(*)::integer quantity, round(avg(e.final_score), 2) average_score, (SELECT count(*)::integer FROM public.ps_evaluation_rectifications r JOIN public.ps_evaluation_reviews review ON review.id = r.review_id WHERE review.event_id = p_event_id AND review.reviewer_collaborator_id = (SELECT ec.collaborator_id FROM public.ps_event_collaborators ec WHERE ec.id = e.evaluator_event_collaborator_id)) rectifications FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = 'subcoordinator' GROUP BY e.evaluator_name, e.evaluator_event_collaborator_id) summary), '[]'::jsonb),
    (SELECT count(*)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations) AND e.final_score < 3),
    (SELECT count(DISTINCT e.collaborator_id)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations) AND e.final_score < 3),
    (SELECT count(*)::integer FROM public.ps_evaluations e WHERE e.event_id = p_event_id AND e.evaluation_level = ANY(v_evaluations) AND e.role_changed),
    (SELECT count(DISTINCT r.evaluation_id)::integer FROM public.ps_evaluation_rectifications r JOIN public.ps_evaluation_reviews review ON review.id = r.review_id WHERE review.event_id = p_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_coordinator_evaluation_dashboard(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_coordinator_evaluation_dashboard(uuid, text) TO anon, authenticated;