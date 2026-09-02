CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.ps_evaluator_accounts
  ADD COLUMN IF NOT EXISTS failed_login_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ps_evaluator_accounts'::regclass
      AND conname = 'ps_evaluator_accounts_failed_attempts_check'
  ) THEN
    ALTER TABLE public.ps_evaluator_accounts
      ADD CONSTRAINT ps_evaluator_accounts_failed_attempts_check
      CHECK (failed_login_attempts >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ps_evaluator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.ps_evaluator_accounts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_evaluator_sessions_token_hash_check
    CHECK (session_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ps_evaluator_sessions_expiry_check
    CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluator_sessions_token_hash_unique
  ON public.ps_evaluator_sessions (session_token_hash);
CREATE INDEX IF NOT EXISTS ps_evaluator_sessions_account_idx
  ON public.ps_evaluator_sessions (account_id);
CREATE INDEX IF NOT EXISTS ps_evaluator_sessions_event_idx
  ON public.ps_evaluator_sessions (event_id);
CREATE INDEX IF NOT EXISTS ps_evaluator_sessions_expires_idx
  ON public.ps_evaluator_sessions (expires_at)
  WHERE revoked_at IS NULL;

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
    RETURN QUERY SELECT false, NULL::boolean, NULL::uuid, NULL::uuid, NULL::text,
      NULL::text, NULL::uuid, NULL::text, NULL::date;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT true,
    a.must_change_password,
    a.id,
    a.collaborator_id,
    c.full_name,
    a.role,
    s.event_id,
    e.name,
    e.date
  FROM public.ps_evaluator_sessions s
  JOIN public.ps_evaluator_accounts a ON a.id = s.account_id
  JOIN public.ps_collaborators c ON c.id = a.collaborator_id
  JOIN public.ps_events e ON e.id = s.event_id
  WHERE s.event_id = p_event_id
    AND s.session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND a.event_id = s.event_id
    AND a.active
    AND a.role IN ('coordinator', 'subcoordinator');

  IF FOUND THEN
    UPDATE public.ps_evaluator_sessions
    SET last_used_at = now()
    WHERE session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
      AND event_id = p_event_id
      AND revoked_at IS NULL
      AND expires_at > now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_login(
  p_event_id uuid,
  p_username text,
  p_password text
) RETURNS TABLE (
  success boolean,
  session_token text,
  expires_at timestamptz,
  must_change_password boolean,
  evaluator_name text,
  role text,
  event_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_event_name text;
  v_name text;
  v_token text;
  v_expires_at timestamptz;
  v_username text := nullif(regexp_replace(coalesce(p_username, ''), '[^0-9A-Za-z]', '', 'g'), '');
BEGIN
  SELECT name INTO v_event_name FROM public.ps_events WHERE id = p_event_id;
  SELECT * INTO v_account
  FROM public.ps_evaluator_accounts
  WHERE event_id = p_event_id
    AND username = v_username
  FOR UPDATE;

  IF v_event_name IS NULL OR NOT FOUND OR NOT v_account.active
    OR v_account.role NOT IN ('coordinator', 'subcoordinator') THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz, NULL::boolean,
      NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_account.locked_until IS NOT NULL AND v_account.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, v_account.locked_until, NULL::boolean,
      NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  IF nullif(p_password, '') IS NULL
    OR extensions.crypt(p_password, v_account.password_hash) <> v_account.password_hash THEN
    UPDATE public.ps_evaluator_accounts
    SET failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE locked_until
        END
    WHERE id = v_account.id;
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz, NULL::boolean,
      NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  SELECT full_name INTO v_name
  FROM public.ps_collaborators
  WHERE id = v_account.collaborator_id;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '12 hours';

  INSERT INTO public.ps_evaluator_sessions (
    account_id, event_id, session_token_hash, expires_at
  ) VALUES (
    v_account.id,
    p_event_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    v_expires_at
  );

  UPDATE public.ps_evaluator_accounts
  SET failed_login_attempts = 0,
      locked_until = NULL,
      last_login = now()
  WHERE id = v_account.id;

  RETURN QUERY SELECT true, v_token, v_expires_at, v_account.must_change_password,
    v_name, v_account.role, v_event_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_session(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT * FROM public.ps_validate_evaluator_session(p_event_id, p_session_token);
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_change_password(
  p_event_id uuid,
  p_session_token text,
  p_current_password text,
  p_new_password text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_session record;
  v_account public.ps_evaluator_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.ps_validate_evaluator_session(p_event_id, p_session_token)
  WHERE valid;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_account
  FROM public.ps_evaluator_accounts
  WHERE id = v_session.account_id
    AND event_id = p_event_id
    AND active
  FOR UPDATE;
  IF NOT FOUND OR extensions.crypt(coalesce(p_current_password, ''), v_account.password_hash) <> v_account.password_hash THEN
    RETURN false;
  END IF;
  IF length(coalesce(p_new_password, '')) < 8
    OR p_new_password !~ '[A-Za-z]'
    OR p_new_password !~ '[0-9]'
    OR p_new_password = v_account.username
    OR extensions.crypt(p_new_password, v_account.password_hash) = v_account.password_hash THEN
    RETURN false;
  END IF;

  UPDATE public.ps_evaluator_accounts
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 12)),
      must_change_password = false,
      password_changed_at = now()
  WHERE id = v_account.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_evaluator_logout(
  p_event_id uuid,
  p_session_token text
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  UPDATE public.ps_evaluator_sessions
  SET revoked_at = now()
  WHERE event_id = p_event_id
    AND session_token_hash = encode(extensions.digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.ps_validate_evaluator_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_login(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_change_password(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ps_public_evaluator_logout(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_login(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_change_password(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_evaluator_logout(uuid, text) TO anon, authenticated;

DROP TRIGGER IF EXISTS ps_evaluator_accounts_auth_updated ON public.ps_evaluator_accounts;
CREATE TRIGGER ps_evaluator_accounts_auth_updated
BEFORE UPDATE ON public.ps_evaluator_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

REVOKE ALL ON public.ps_evaluator_sessions FROM PUBLIC, anon;
REVOKE SELECT ON public.ps_evaluator_accounts FROM authenticated;
REVOKE SELECT ON public.ps_evaluator_sessions FROM authenticated;
GRANT ALL ON public.ps_evaluator_sessions TO service_role;
ALTER TABLE public.ps_evaluator_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evaluator_sessions internal read"
  ON public.ps_evaluator_sessions FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));