-- ============ ps_event_collaborators ============
DROP POLICY IF EXISTS "ps_evcol public read" ON public.ps_event_collaborators;
DROP POLICY IF EXISTS "ps_evcol public update" ON public.ps_event_collaborators;
REVOKE ALL ON public.ps_event_collaborators FROM anon;

CREATE OR REPLACE FUNCTION public.ps_public_event_roster(p_event_id uuid)
RETURNS TABLE(id uuid, collaborator_id uuid, collaborator_name text, assigned_role text, role_name text, sector text, signed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ec.id, ec.collaborator_id, ec.collaborator_name, ec.assigned_role, ec.role_name, ec.sector, ec.signed_at
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  WHERE ec.event_id = p_event_id
    AND COALESCE(e.hidden_from_evaluation, false) = false
  ORDER BY ec.collaborator_name;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_signature IS NULL OR length(p_signature) < 50 OR length(p_signature) > 500000 THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  UPDATE public.ps_event_collaborators ec
  SET signature_url = p_signature, signed_at = now()
  WHERE ec.id = p_link_id
    AND ec.signed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = ec.event_id AND COALESCE(e.hidden_from_evaluation,false) = false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado ou já assinado';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated;

-- ============ ps_evaluations ============
DROP POLICY IF EXISTS "ps_evaluations public read" ON public.ps_evaluations;
DROP POLICY IF EXISTS "ps_evaluations public insert" ON public.ps_evaluations;
REVOKE ALL ON public.ps_evaluations FROM anon;

CREATE OR REPLACE FUNCTION public.ps_public_submit_evaluation(
  p_event_id uuid,
  p_link_id uuid,
  p_assigned_role text,
  p_evaluator_name text,
  p_observations text,
  p_criteria jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_keys text[] := ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'];
  k text;
  v int;
  v_sum numeric := 0;
  v_score numeric;
  v_class text;
  v_id uuid;
BEGIN
  IF coalesce(trim(p_evaluator_name),'') = '' THEN
    RAISE EXCEPTION 'Informe o nome do avaliador';
  END IF;

  SELECT * INTO v_link FROM public.ps_event_collaborators
  WHERE id = p_link_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiscal não encontrado neste evento';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = p_event_id AND COALESCE(e.hidden_from_evaluation,false) = false) THEN
    RAISE EXCEPTION 'Evento não disponível para avaliação';
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    v := (p_criteria ->> k)::int;
    IF v IS NULL OR v < 1 OR v > 5 THEN
      RAISE EXCEPTION 'Critério inválido: %', k;
    END IF;
    v_sum := v_sum + v;
  END LOOP;

  v_score := round((v_sum / array_length(v_keys,1))::numeric, 2);
  v_class := CASE
    WHEN v_score >= 4.5 THEN 'excelente'
    WHEN v_score >= 3.5 THEN 'bom'
    WHEN v_score >= 2.5 THEN 'regular'
    ELSE 'insuficiente'
  END;

  INSERT INTO public.ps_evaluations (
    event_id, collaborator_id, collaborator_name, sector, assigned_role,
    evaluator_name, observations,
    punctuality, domain, room_control, attention_vigilance, professional_posture,
    communication, organization, incident_management, teamwork,
    final_score, classification
  ) VALUES (
    p_event_id, v_link.collaborator_id, v_link.collaborator_name, v_link.sector,
    COALESCE(NULLIF(trim(p_assigned_role),''), v_link.assigned_role, 'fiscal_sala'),
    left(trim(p_evaluator_name), 200), left(NULLIF(trim(coalesce(p_observations,'')),''), 2000),
    (p_criteria->>'punctuality')::int, (p_criteria->>'domain')::int, (p_criteria->>'room_control')::int,
    (p_criteria->>'attention_vigilance')::int, (p_criteria->>'professional_posture')::int,
    (p_criteria->>'communication')::int, (p_criteria->>'organization')::int,
    (p_criteria->>'incident_management')::int, (p_criteria->>'teamwork')::int,
    v_score, v_class
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated;

-- ============ ps_self_evaluations ============
DROP POLICY IF EXISTS "ps_self_eval public insert" ON public.ps_self_evaluations;
CREATE POLICY "ps_self_eval public insert validated"
ON public.ps_self_evaluations FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = event_id AND COALESCE(e.hidden_from_evaluation,false) = false)
  AND (identified = false OR coalesce(length(trim(respondent_name)),0) BETWEEN 2 AND 200)
  AND (training_rating IS NULL OR training_rating BETWEEN 1 AND 5)
  AND (organization_rating IS NULL OR organization_rating BETWEEN 1 AND 5)
  AND (snack_rating IS NULL OR snack_rating BETWEEN 1 AND 5)
  AND (partner_fiscal_rating IS NULL OR partner_fiscal_rating BETWEEN 1 AND 5)
  AND coalesce(length(suggestions),0) <= 4000
  AND coalesce(length(incident_comment),0) <= 4000
  AND coalesce(length(training_comment),0) <= 4000
  AND coalesce(length(organization_comment),0) <= 4000
  AND coalesce(length(snack_comment),0) <= 4000
  AND coalesce(length(partner_fiscal_comment),0) <= 4000
);

-- ============ ps_evaluation_retifications ============
DROP POLICY IF EXISTS "ps_retif public insert" ON public.ps_evaluation_retifications;
CREATE POLICY "ps_retif public insert validated"
ON public.ps_evaluation_retifications FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ps_evaluations ev
    WHERE ev.id = evaluation_id
      AND ev.event_id = ps_evaluation_retifications.event_id
      AND ev.collaborator_id = ps_evaluation_retifications.collaborator_id
  )
  AND coalesce(length(trim(reason)),0) BETWEEN 5 AND 4000
  AND coalesce(length(requested_by),0) <= 200
  AND status = 'pendente'
);

-- ============ classroom_calls ============
DROP POLICY IF EXISTS "Recent calls visible for real-time updates" ON public.classroom_calls;
DROP POLICY IF EXISTS "Anyone can create classroom calls from external form" ON public.classroom_calls;
REVOKE ALL ON public.classroom_calls FROM anon;

CREATE OR REPLACE FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_room_name),'') = '' THEN
    RAISE EXCEPTION 'Sala obrigatória';
  END IF;
  INSERT INTO public.classroom_calls (room_name, reason, status, campus)
  VALUES (left(trim(p_room_name), 200), left(coalesce(trim(p_reason),''), 1000), 'pending', left(coalesce(trim(p_campus),''), 100))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_classroom_call_status(p_id uuid)
RETURNS TABLE(status text, accepted_by_name text, accepted_at timestamptz, response_message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.status, c.accepted_by_name, c.accepted_at, c.response_message
  FROM public.classroom_calls c
  WHERE c.id = p_id AND c.created_at > now() - interval '6 hours';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) TO anon, authenticated;