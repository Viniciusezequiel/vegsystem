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
  LIMIT 100;
END;
$$;
