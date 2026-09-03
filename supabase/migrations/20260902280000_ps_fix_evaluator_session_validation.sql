CREATE OR REPLACE FUNCTION public.ps_validate_evaluator_session(
  p_event_id uuid,
  p_session_token text
) RETURNS TABLE (
  valid boolean,
  must_change_password boolean,
  account_id uuid,
  collaborator_id uuid,
  evaluator_name text,
  role text,
  event_id uuid,
  event_name text,
  event_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL OR nullif(p_session_token, '') IS NULL THEN
    RETURN QUERY
    SELECT
      false,
      NULL::boolean,
      NULL::uuid,
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::uuid,
      NULL::text,
      NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    a.must_change_password,
    a.id,
    a.collaborator_id,
    c.full_name,
    a.role,
    s.event_id,
    e.name,
    e.date
  FROM public.ps_evaluator_sessions AS s
  JOIN public.ps_evaluator_accounts AS a
    ON a.id = s.account_id
  JOIN public.ps_collaborators AS c
    ON c.id = a.collaborator_id
  JOIN public.ps_events AS e
    ON e.id = s.event_id
  WHERE s.event_id = p_event_id
    AND s.session_token_hash =
      encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND a.event_id = s.event_id
    AND a.active
    AND a.role IN ('coordinator', 'subcoordinator');

  IF FOUND THEN
    UPDATE public.ps_evaluator_sessions AS sess
    SET last_used_at = now()
    WHERE sess.session_token_hash =
      encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND sess.event_id = p_event_id
      AND sess.revoked_at IS NULL
      AND sess.expires_at > now();
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.ps_validate_evaluator_session(uuid, text)
FROM PUBLIC, anon, authenticated;
