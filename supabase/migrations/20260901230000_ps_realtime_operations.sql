ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS departed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluations_event_collaborator_unique
  ON public.ps_evaluations (event_id, collaborator_id)
  WHERE collaborator_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ps_public_search_event_roster(p_event_id uuid, p_search text DEFAULT '')
RETURNS TABLE(
  id uuid, collaborator_id uuid, collaborator_name text, matricula_masked text, email_masked text,
  assigned_role text, role_name text, sector text, present boolean, absent boolean,
  signed_at timestamptz, departed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT ec.id, ec.collaborator_id, ec.collaborator_name,
    CASE WHEN c.matricula IS NULL THEN NULL ELSE left(c.matricula, 2) || '***' || right(c.matricula, 2) END,
    CASE WHEN c.email IS NULL THEN NULL ELSE left(c.email, 2) || '***@' || split_part(c.email, '@', 2) END,
    ec.assigned_role, ec.role_name, ec.sector, ec.present, ec.absent, ec.signed_at, ec.departed_at
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  JOIN public.ps_collaborators c ON c.id = ec.collaborator_id
  WHERE ec.event_id = p_event_id
    AND COALESCE(e.hidden_from_evaluation, false) = false
    AND (
      length(trim(coalesce(p_search, ''))) >= 2
      AND (ec.collaborator_name ILIKE '%' || trim(p_search) || '%'
        OR c.matricula ILIKE '%' || trim(p_search) || '%'
        OR c.email ILIKE '%' || trim(p_search) || '%')
    )
  ORDER BY ec.collaborator_name
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.ps_public_search_event_roster(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_search_event_roster(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_set_event_participant_state(
  p_link_id uuid,
  p_expected_updated_at timestamptz,
  p_present boolean,
  p_absent boolean,
  p_departed_at timestamptz DEFAULT NULL
)
RETURNS TABLE(success boolean, conflict boolean, updated_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_present AND p_absent THEN
    RAISE EXCEPTION 'contradictory_presence' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.ps_event_collaborators ec
  SET present = p_present, absent = p_absent, departed_at = p_departed_at
  WHERE ec.id = p_link_id AND ec.updated_at = p_expected_updated_at
  RETURNING true, false, ec.updated_at;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, true, NULL::timestamptz;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_set_event_participant_state(uuid, timestamptz, boolean, boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_set_event_participant_state(uuid, timestamptz, boolean, boolean, timestamptz) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ps_event_collaborators') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ps_event_collaborators;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ps_evaluations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ps_evaluations;
  END IF;
END $$;
