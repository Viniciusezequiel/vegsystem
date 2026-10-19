-- Permite autoavaliação pós-evento sem reabrir presença/operação.
-- O evento pode continuar finalizado; basta estar explicitamente habilitado para autoavaliação.

CREATE OR REPLACE FUNCTION public.ps_public_list_events(
  p_surface text DEFAULT 'attendance'
)
RETURNS TABLE(
  id uuid,
  name text,
  date date,
  status text,
  self_evaluation_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    e.id,
    e.name,
    e.date,
    e.status,
    coalesce(e.self_evaluation_enabled, false)
  FROM public.ps_events e
  WHERE
    coalesce(e.hidden_from_evaluation, false) = false
    AND (
      (
        p_surface = 'attendance'
        AND e.status <> 'finalizado'
      )
      OR (
        p_surface = 'self_evaluation'
        AND coalesce(e.self_evaluation_enabled, false) = true
      )
    )
  ORDER BY
    CASE
      WHEN p_surface = 'attendance' AND e.status = 'em_andamento' THEN 0
      WHEN p_surface = 'attendance' THEN 1
      ELSE 0
    END,
    CASE
      WHEN p_surface = 'attendance' THEN abs(e.date - current_date)
      ELSE 0
    END,
    e.date DESC,
    e.name
  LIMIT CASE
    WHEN p_surface = 'attendance' THEN 1
    ELSE 500
  END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_list_events(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_list_events(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_public_submit_self_evaluation(
  p_event_id uuid,
  p_identified boolean,
  p_respondent_name text,
  p_role text,
  p_campus text,
  p_floor text,
  p_room text,
  p_training_rating integer,
  p_training_comment text,
  p_organization_rating integer,
  p_organization_comment text,
  p_snack_rating integer,
  p_snack_comment text,
  p_partner_fiscal_rating integer,
  p_partner_fiscal_comment text,
  p_had_incident boolean,
  p_incident_comment text,
  p_suggestions text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ps_events e
    WHERE e.id = p_event_id
      AND coalesce(e.hidden_from_evaluation, false) = false
      AND coalesce(e.self_evaluation_enabled, false) = true
  ) THEN
    RAISE EXCEPTION 'self_evaluation_not_available';
  END IF;

  IF coalesce(p_identified, false)
     AND nullif(trim(coalesce(p_respondent_name, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'respondent_name_required';
  END IF;

  IF length(trim(coalesce(p_respondent_name, ''))) > 200 THEN
    RAISE EXCEPTION 'respondent_name_too_long';
  END IF;

  IF nullif(trim(coalesce(p_role, '')), '') IS NULL THEN
    RAISE EXCEPTION 'role_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ps_roles r
    WHERE r.value = trim(p_role)
      AND r.active = true
  ) THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  IF nullif(trim(coalesce(p_campus, '')), '') IS NULL THEN
    RAISE EXCEPTION 'campus_required';
  END IF;

  IF
    (p_training_rating IS NOT NULL AND p_training_rating NOT BETWEEN 1 AND 5)
    OR (p_organization_rating IS NOT NULL AND p_organization_rating NOT BETWEEN 1 AND 5)
    OR (p_snack_rating IS NOT NULL AND p_snack_rating NOT BETWEEN 1 AND 5)
    OR (p_partner_fiscal_rating IS NOT NULL AND p_partner_fiscal_rating NOT BETWEEN 1 AND 5)
  THEN
    RAISE EXCEPTION 'invalid_rating';
  END IF;

  IF p_training_rating <= 2
     AND nullif(trim(coalesce(p_training_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'training_comment_required';
  END IF;

  IF p_organization_rating <= 2
     AND nullif(trim(coalesce(p_organization_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'organization_comment_required';
  END IF;

  IF p_snack_rating <= 2
     AND nullif(trim(coalesce(p_snack_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'snack_comment_required';
  END IF;

  IF p_partner_fiscal_rating <= 2
     AND nullif(trim(coalesce(p_partner_fiscal_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'partner_comment_required';
  END IF;

  IF coalesce(p_had_incident, false)
     AND nullif(trim(coalesce(p_incident_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'incident_comment_required';
  END IF;

  IF
    length(coalesce(p_training_comment, '')) > 4000
    OR length(coalesce(p_organization_comment, '')) > 4000
    OR length(coalesce(p_snack_comment, '')) > 4000
    OR length(coalesce(p_partner_fiscal_comment, '')) > 4000
    OR length(coalesce(p_incident_comment, '')) > 4000
    OR length(coalesce(p_suggestions, '')) > 4000
  THEN
    RAISE EXCEPTION 'self_evaluation_text_too_long';
  END IF;

  INSERT INTO public.ps_self_evaluations (
    event_id, identified, respondent_name, role, campus, floor, room,
    training_rating, training_comment,
    organization_rating, organization_comment,
    snack_rating, snack_comment,
    partner_fiscal_rating, partner_fiscal_comment,
    had_incident, incident_comment, suggestions
  )
  VALUES (
    p_event_id,
    coalesce(p_identified, false),
    CASE WHEN coalesce(p_identified, false) THEN trim(p_respondent_name) ELSE NULL END,
    trim(p_role),
    trim(p_campus),
    nullif(trim(coalesce(p_floor, '')), ''),
    nullif(trim(coalesce(p_room, '')), ''),
    p_training_rating,
    nullif(trim(coalesce(p_training_comment, '')), ''),
    p_organization_rating,
    nullif(trim(coalesce(p_organization_comment, '')), ''),
    p_snack_rating,
    nullif(trim(coalesce(p_snack_comment, '')), ''),
    p_partner_fiscal_rating,
    nullif(trim(coalesce(p_partner_fiscal_comment, '')), ''),
    coalesce(p_had_incident, false),
    CASE WHEN coalesce(p_had_incident, false) THEN nullif(trim(coalesce(p_incident_comment, '')), '') ELSE NULL END,
    nullif(trim(coalesce(p_suggestions, '')), '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_submit_self_evaluation(
  uuid, boolean, text, text, text, text, text, integer, text,
  integer, text, integer, text, integer, text, boolean, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ps_public_submit_self_evaluation(
  uuid, boolean, text, text, text, text, text, integer, text,
  integer, text, integer, text, integer, text, boolean, text, text
) TO anon, authenticated;
