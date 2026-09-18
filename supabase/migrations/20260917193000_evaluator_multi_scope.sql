-- Evaluator access scopes can be broad (whole event) or contain several locations.
-- Existing or future scope defaults are intentionally not changed globally here;
-- each event remains under explicit administrator control.

CREATE OR REPLACE FUNCTION public.ps_admin_list_evaluator_scope_details(
  p_event_id uuid
) RETURNS TABLE (
  account_id uuid,
  scopes jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', scope.id,
          'scope_type', scope.scope_type,
          'campus', scope.campus,
          'building', scope.building,
          'floor', scope.floor,
          'source', scope.source
        )
        ORDER BY
          CASE scope.scope_type
            WHEN 'event' THEN 0
            WHEN 'campus' THEN 1
            WHEN 'building' THEN 2
            ELSE 3
          END,
          scope.campus NULLS FIRST,
          scope.building NULLS FIRST,
          scope.floor NULLS FIRST
      ) FILTER (WHERE scope.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM public.ps_evaluator_accounts a
  LEFT JOIN public.ps_event_collaborators link
    ON link.event_id = a.event_id
   AND link.collaborator_id = a.collaborator_id
  LEFT JOIN public.ps_event_evaluator_scopes scope
    ON scope.event_id = a.event_id
   AND scope.evaluator_event_collaborator_id = link.id
   AND scope.active
  WHERE a.event_id = p_event_id
    AND a.active
    AND public.is_admin(auth.uid())
  GROUP BY a.id;
$$;

CREATE OR REPLACE FUNCTION public.ps_admin_replace_evaluator_scopes(
  p_account_id uuid,
  p_scopes jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_link_id uuid;
  v_scope jsonb;
  v_scope_type text;
  v_campus text;
  v_building text;
  v_floor text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'evaluator_admin_required';
  END IF;

  SELECT * INTO v_account
  FROM public.ps_evaluator_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF jsonb_typeof(p_scopes) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_scopes) < 1
     OR jsonb_array_length(p_scopes) > 20 THEN
    RAISE EXCEPTION 'invalid_evaluator_scopes';
  END IF;

  SELECT ec.id INTO v_link_id
  FROM public.ps_event_collaborators ec
  WHERE ec.event_id = v_account.event_id
    AND ec.collaborator_id = v_account.collaborator_id
  ORDER BY ec.created_at DESC
  LIMIT 1;

  IF v_link_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_scopes) item
    WHERE item->>'scope_type' = 'event'
  ) AND jsonb_array_length(p_scopes) <> 1 THEN
    RAISE EXCEPTION 'event_scope_must_be_exclusive';
  END IF;

  DELETE FROM public.ps_event_evaluator_scopes
  WHERE event_id = v_account.event_id
    AND evaluator_event_collaborator_id = v_link_id;

  FOR v_scope IN SELECT value FROM jsonb_array_elements(p_scopes)
  LOOP
    v_scope_type := nullif(trim(v_scope->>'scope_type'), '');
    v_campus := nullif(trim(v_scope->>'campus'), '');
    v_building := nullif(trim(v_scope->>'building'), '');
    v_floor := nullif(trim(v_scope->>'floor'), '');

    IF v_scope_type NOT IN ('event', 'campus', 'building', 'floor')
       OR (v_scope_type = 'campus' AND v_campus IS NULL)
       OR (v_scope_type = 'building' AND (v_campus IS NULL OR v_building IS NULL))
       OR (v_scope_type = 'floor' AND (v_campus IS NULL OR v_building IS NULL OR v_floor IS NULL)) THEN
      RAISE EXCEPTION 'invalid_evaluator_scope';
    END IF;

    INSERT INTO public.ps_event_evaluator_scopes (
      event_id, evaluator_event_collaborator_id, campus, building, floor,
      scope_type, source, active
    ) VALUES (
      v_account.event_id,
      v_link_id,
      CASE WHEN v_scope_type = 'event' THEN NULL ELSE v_campus END,
      CASE WHEN v_scope_type IN ('event', 'campus') THEN NULL ELSE v_building END,
      CASE WHEN v_scope_type <> 'floor' THEN NULL ELSE v_floor END,
      v_scope_type,
      'manual',
      true
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_list_evaluator_scope_details(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_list_evaluator_scope_details(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ps_admin_replace_evaluator_scopes(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_replace_evaluator_scopes(uuid, jsonb) TO authenticated;
