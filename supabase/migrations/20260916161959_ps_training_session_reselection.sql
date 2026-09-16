-- Processo Seletivo: cancelamento de uma data de treinamento e escolha de nova data.

ALTER TABLE public.ps_event_training_sessions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE TABLE IF NOT EXISTS public.ps_training_reselection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  training_group_id uuid NOT NULL REFERENCES public.ps_event_training_groups(id) ON DELETE CASCADE,
  cancelled_session_id uuid NOT NULL REFERENCES public.ps_event_training_sessions(id) ON DELETE RESTRICT,
  replacement_session_id uuid REFERENCES public.ps_event_training_sessions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'superseded')),
  reason text,
  token_hash text,
  token_version integer NOT NULL DEFAULT 0,
  token_expires_at timestamptz,
  token_revoked_at timestamptz,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_training_reselection_token_hash_uidx
  ON public.ps_training_reselection_requests(token_hash)
  WHERE token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ps_training_reselection_pending_uidx
  ON public.ps_training_reselection_requests(event_collaborator_id, training_group_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ps_training_reselection_event_idx
  ON public.ps_training_reselection_requests(event_id, cancelled_session_id, status);
CREATE INDEX IF NOT EXISTS ps_training_reselection_cancelled_session_idx
  ON public.ps_training_reselection_requests(cancelled_session_id);
CREATE INDEX IF NOT EXISTS ps_training_reselection_group_idx
  ON public.ps_training_reselection_requests(training_group_id);
CREATE INDEX IF NOT EXISTS ps_training_reselection_replacement_session_idx
  ON public.ps_training_reselection_requests(replacement_session_id)
  WHERE replacement_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ps_training_reselection_created_by_idx
  ON public.ps_training_reselection_requests(created_by)
  WHERE created_by IS NOT NULL;

DROP TRIGGER IF EXISTS ps_training_reselection_updated ON public.ps_training_reselection_requests;
CREATE TRIGGER ps_training_reselection_updated
  BEFORE UPDATE ON public.ps_training_reselection_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ps_training_reselection_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.ps_training_reselection_requests TO authenticated;
GRANT ALL ON public.ps_training_reselection_requests TO service_role;
DROP POLICY IF EXISTS "ps_training_reselection internal read" ON public.ps_training_reselection_requests;
CREATE POLICY "ps_training_reselection internal read"
  ON public.ps_training_reselection_requests
  FOR SELECT TO authenticated
  USING ((SELECT public.is_internal_user((SELECT auth.uid()))));

ALTER TABLE public.ps_event_communications
  ADD COLUMN IF NOT EXISTS training_reselection_request_id uuid
    REFERENCES public.ps_training_reselection_requests(id) ON DELETE SET NULL;

ALTER TABLE public.ps_event_communications
  DROP CONSTRAINT IF EXISTS ps_event_communications_communication_type_check;
ALTER TABLE public.ps_event_communications
  ADD CONSTRAINT ps_event_communications_communication_type_check
  CHECK (communication_type IN ('confirmation_request', 'event_message', 'training_reselection'));

CREATE UNIQUE INDEX IF NOT EXISTS ps_event_communications_reselection_version_uidx
  ON public.ps_event_communications(training_reselection_request_id, communication_type, confirmation_token_version)
  WHERE communication_type = 'training_reselection'
    AND training_reselection_request_id IS NOT NULL
    AND confirmation_token_version IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ps_cancel_training_session(
  p_session_id uuid,
  p_reason text,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(request_id uuid, event_id uuid, event_collaborator_id uuid, training_group_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_session public.ps_event_training_sessions%ROWTYPE;
  v_reason text := NULLIF(trim(p_reason), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'cancellation_reason_required';
  END IF;

  SELECT * INTO v_session
  FROM public.ps_event_training_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'training_session_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.ps_event_training_sessions alternative
    WHERE alternative.training_group_id = v_session.training_group_id
      AND alternative.event_id = v_session.event_id
      AND alternative.id <> v_session.id
      AND alternative.active = true
      AND alternative.cancelled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'no_alternative_training_session';
  END IF;

  IF v_session.cancelled_at IS NULL THEN
    UPDATE public.ps_training_reselection_requests request
    SET status = 'superseded', token_revoked_at = now()
    WHERE request.status = 'pending'
      AND request.training_group_id = v_session.training_group_id
      AND request.event_collaborator_id IN (
        SELECT choice.event_collaborator_id
        FROM public.ps_event_training_choices choice
        WHERE choice.training_session_id = v_session.id
      );

    UPDATE public.ps_event_training_sessions
    SET active = false,
        cancelled_at = now(),
        cancellation_reason = v_reason,
        updated_at = now()
    WHERE id = v_session.id;

    INSERT INTO public.ps_training_reselection_requests (
      event_id,
      event_collaborator_id,
      training_group_id,
      cancelled_session_id,
      reason,
      created_by
    )
    SELECT
      choice.event_id,
      choice.event_collaborator_id,
      choice.training_group_id,
      choice.training_session_id,
      v_reason,
      p_created_by
    FROM public.ps_event_training_choices choice
    WHERE choice.training_session_id = v_session.id;
  END IF;

  RETURN QUERY
  SELECT request.id, request.event_id, request.event_collaborator_id, request.training_group_id
  FROM public.ps_training_reselection_requests request
  WHERE request.cancelled_session_id = v_session.id
    AND request.status = 'pending'
  ORDER BY request.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_cancel_training_session(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_cancel_training_session(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ps_prepare_training_reselection_communication(p_request_id uuid)
RETURNS TABLE(token text, token_version integer, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
BEGIN
  RETURN QUERY
  UPDATE public.ps_training_reselection_requests request
  SET token_version = request.token_version + 1,
      token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
      token_expires_at = now() + interval '7 days',
      token_revoked_at = NULL,
      updated_at = now()
  WHERE request.id = p_request_id
    AND request.status = 'pending'
  RETURNING v_token, request.token_version, request.token_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_prepare_training_reselection_communication(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_prepare_training_reselection_communication(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.ps_public_get_training_reselection(p_event_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ps_training_reselection_requests%ROWTYPE;
  v_event public.ps_events%ROWTYPE;
  v_group public.ps_event_training_groups%ROWTYPE;
  v_cancelled public.ps_event_training_sessions%ROWTYPE;
  v_name text;
BEGIN
  SELECT request.* INTO v_request
  FROM public.ps_training_reselection_requests request
  WHERE request.event_id = p_event_id
    AND request.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_event FROM public.ps_events WHERE id = v_request.event_id;
  SELECT * INTO v_group FROM public.ps_event_training_groups WHERE id = v_request.training_group_id;
  SELECT * INTO v_cancelled FROM public.ps_event_training_sessions WHERE id = v_request.cancelled_session_id;
  SELECT collaborator_name INTO v_name
  FROM public.ps_event_collaborators
  WHERE id = v_request.event_collaborator_id;

  RETURN jsonb_build_object(
    'request_id', v_request.id,
    'event_name', v_event.name,
    'collaborator_name', v_name,
    'training_group_id', v_group.id,
    'training_group_name', v_group.name,
    'reason', v_request.reason,
    'cancelled_session', jsonb_build_object(
      'id', v_cancelled.id,
      'starts_at', v_cancelled.starts_at,
      'campus', v_cancelled.campus,
      'location', v_cancelled.location,
      'room', v_cancelled.room
    ),
    'token_state', CASE
      WHEN v_request.status = 'completed' OR v_request.token_revoked_at IS NOT NULL THEN 'used'
      WHEN v_request.status <> 'pending' THEN 'invalid'
      WHEN v_request.token_expires_at <= now() THEN 'expired'
      ELSE 'valid'
    END,
    'replacement_session_id', v_request.replacement_session_id,
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', session.id,
        'starts_at', session.starts_at,
        'ends_at', session.ends_at,
        'campus', session.campus,
        'location', session.location,
        'room', session.room,
        'capacity', session.capacity,
        'selected_count', (SELECT count(*) FROM public.ps_event_training_choices choice WHERE choice.training_session_id = session.id),
        'available', session.capacity IS NULL OR (SELECT count(*) FROM public.ps_event_training_choices choice WHERE choice.training_session_id = session.id) < session.capacity
      ) ORDER BY session.starts_at)
      FROM public.ps_event_training_sessions session
      WHERE session.training_group_id = v_request.training_group_id
        AND session.event_id = v_request.event_id
        AND session.active = true
        AND session.cancelled_at IS NULL
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_get_training_reselection(p_event_id uuid, p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.ps_public_get_training_reselection(p_event_id, p_token);
$$;

CREATE OR REPLACE FUNCTION private.ps_public_set_training_reselection(
  p_event_id uuid,
  p_token text,
  p_training_session_id uuid
)
RETURNS TABLE(success boolean, training_session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.ps_training_reselection_requests%ROWTYPE;
  v_capacity integer;
  v_taken integer;
BEGIN
  SELECT request.* INTO v_request
  FROM public.ps_training_reselection_requests request
  WHERE request.event_id = p_event_id
    AND request.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  IF v_request.status = 'completed' AND v_request.replacement_session_id = p_training_session_id THEN
    RETURN QUERY SELECT true, v_request.replacement_session_id;
    RETURN;
  END IF;

  IF v_request.status <> 'pending'
    OR v_request.token_revoked_at IS NOT NULL
    OR v_request.token_expires_at <= now() THEN
    RETURN QUERY SELECT false, NULL::uuid;
    RETURN;
  END IF;

  SELECT session.capacity INTO v_capacity
  FROM public.ps_event_training_sessions session
  WHERE session.id = p_training_session_id
    AND session.event_id = v_request.event_id
    AND session.training_group_id = v_request.training_group_id
    AND session.active = true
    AND session.cancelled_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_training_selection';
  END IF;

  SELECT count(*) INTO v_taken
  FROM public.ps_event_training_choices choice
  WHERE choice.training_session_id = p_training_session_id
    AND NOT (
      choice.event_collaborator_id = v_request.event_collaborator_id
      AND choice.training_group_id = v_request.training_group_id
    );

  IF v_capacity IS NOT NULL AND v_taken >= v_capacity THEN
    RAISE EXCEPTION 'training_session_full';
  END IF;

  UPDATE public.ps_event_training_choices choice
  SET training_session_id = p_training_session_id,
      selected_at = now(),
      updated_at = now()
  WHERE choice.event_collaborator_id = v_request.event_collaborator_id
    AND choice.training_group_id = v_request.training_group_id
    AND choice.event_id = v_request.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'training_choice_not_found';
  END IF;

  UPDATE public.ps_training_reselection_requests request
  SET status = 'completed',
      replacement_session_id = p_training_session_id,
      used_at = now(),
      token_revoked_at = now(),
      updated_at = now()
  WHERE request.id = v_request.id;

  RETURN QUERY SELECT true, p_training_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_public_set_training_reselection(
  p_event_id uuid,
  p_token text,
  p_training_session_id uuid
)
RETURNS TABLE(success boolean, training_session_id uuid)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.ps_public_set_training_reselection(p_event_id, p_token, p_training_session_id);
$$;

REVOKE ALL ON FUNCTION public.ps_public_get_training_reselection(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_public_set_training_reselection(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_get_training_reselection(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_set_training_reselection(uuid, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
