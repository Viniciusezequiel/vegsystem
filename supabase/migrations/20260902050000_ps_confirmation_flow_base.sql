CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS participation_status text NOT NULL DEFAULT 'pending_confirmation',
  ADD COLUMN IF NOT EXISTS confirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS replacement_for_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS original_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_confirmation_token_hash text,
  ADD COLUMN IF NOT EXISTS public_confirmation_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_confirmation_token_revoked_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.ps_event_collaborators'::regclass AND conname='ps_event_collaborators_participation_status_check') THEN
    ALTER TABLE public.ps_event_collaborators ADD CONSTRAINT ps_event_collaborators_participation_status_check
      CHECK (participation_status IN ('pending_confirmation', 'confirmed', 'declined', 'replaced')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.ps_event_collaborators VALIDATE CONSTRAINT ps_event_collaborators_participation_status_check;

CREATE INDEX IF NOT EXISTS ps_event_collaborators_participation_status_idx ON public.ps_event_collaborators (event_id, participation_status);
CREATE INDEX IF NOT EXISTS ps_event_collaborators_replacement_idx ON public.ps_event_collaborators (replacement_for_event_collaborator_id);
CREATE UNIQUE INDEX IF NOT EXISTS ps_event_collaborators_public_confirmation_token_hash_idx
  ON public.ps_event_collaborators (public_confirmation_token_hash) WHERE public_confirmation_token_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ps_event_collaborator_confirmation_summary(p_event_id uuid)
RETURNS TABLE (status text, total bigint)
LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT participation_status, count(*)::bigint FROM public.ps_event_collaborators
  WHERE event_id = p_event_id GROUP BY participation_status;
$$;
REVOKE ALL ON FUNCTION public.ps_event_collaborator_confirmation_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_event_collaborator_confirmation_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_request_event_collaborator_confirmation(
  p_link_id uuid, p_rotate boolean DEFAULT false, p_ttl interval DEFAULT interval '72 hours'
) RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_token text; v_expires_at timestamptz;
BEGIN
  IF p_ttl <= interval '5 minutes' OR p_ttl > interval '14 days' THEN RAISE EXCEPTION 'invalid_confirmation_ttl'; END IF;
  SELECT public_confirmation_token_expires_at INTO v_expires_at FROM public.ps_event_collaborators WHERE id=p_link_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_collaborator_not_found'; END IF;
  IF NOT p_rotate AND v_expires_at > now() THEN RAISE EXCEPTION 'active_confirmation_token_exists'; END IF;
  v_token := encode(extensions.gen_random_bytes(32), 'hex'); v_expires_at := now() + p_ttl;
  UPDATE public.ps_event_collaborators SET participation_status='pending_confirmation', confirmation_requested_at=now(),
    confirmed_at=NULL, declined_at=NULL, decline_reason=NULL,
    public_confirmation_token_hash=encode(extensions.digest(v_token, 'sha256'), 'hex'),
    public_confirmation_token_expires_at=v_expires_at, public_confirmation_token_revoked_at=NULL
  WHERE id=p_link_id;
  RETURN QUERY SELECT v_token, v_expires_at;
END $$;
REVOKE ALL ON FUNCTION public.ps_request_event_collaborator_confirmation(uuid, boolean, interval) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_request_event_collaborator_confirmation(uuid, boolean, interval) TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_public_get_event_collaborator_confirmation(p_event_id uuid, p_token text)
RETURNS TABLE(link_id uuid, event_name text, event_date date, collaborator_name text, role_name text, unit text, room text, participation_status text, token_state text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  SELECT ec.id,e.name,e.date,ec.collaborator_name,coalesce(ec.role_name,ec.assigned_role),ec.unit,ec.room,ec.participation_status,
    CASE WHEN ec.public_confirmation_token_expires_at <= now() THEN 'expired'
         WHEN ec.public_confirmation_token_revoked_at IS NOT NULL THEN 'used'
         ELSE 'valid' END
  FROM public.ps_event_collaborators ec JOIN public.ps_events e ON e.id=ec.event_id
  WHERE ec.event_id=p_event_id AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION public.ps_public_get_event_collaborator_confirmation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_get_event_collaborator_confirmation(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_public_set_event_collaborator_confirmation(
  p_event_id uuid, p_token text, p_status text, p_decline_reason text DEFAULT NULL
) RETURNS TABLE(success boolean, participation_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_status text;
BEGIN
  IF p_status NOT IN ('confirmed','declined') THEN RAISE EXCEPTION 'invalid_confirmation_status'; END IF;
  IF p_status='declined' AND nullif(trim(p_decline_reason),'') IS NULL THEN RAISE EXCEPTION 'decline_reason_required'; END IF;
  UPDATE public.ps_event_collaborators SET participation_status=p_status,
    confirmed_at=CASE WHEN p_status='confirmed' THEN now() ELSE NULL END,
    declined_at=CASE WHEN p_status='declined' THEN now() ELSE NULL END,
    decline_reason=CASE WHEN p_status='declined' THEN trim(p_decline_reason) ELSE NULL END,
    public_confirmation_token_revoked_at=now()
  WHERE event_id=p_event_id AND public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    AND public_confirmation_token_revoked_at IS NULL AND public_confirmation_token_expires_at > now()
    AND ps_event_collaborators.participation_status='pending_confirmation'
  RETURNING ps_event_collaborators.participation_status INTO v_status;
  IF v_status IS NULL THEN
    SELECT ec.participation_status INTO v_status
    FROM public.ps_event_collaborators ec
    WHERE ec.event_id=p_event_id
      AND ec.public_confirmation_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      AND ec.public_confirmation_token_expires_at > now()
      AND ec.public_confirmation_token_revoked_at IS NOT NULL
      AND ec.participation_status=p_status;
  END IF;
  RETURN QUERY SELECT v_status IS NOT NULL, v_status;
END $$;
REVOKE ALL ON FUNCTION public.ps_public_set_event_collaborator_confirmation(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_set_event_collaborator_confirmation(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_replace_event_collaborator(
  p_old_link_id uuid, p_new_collaborator_id uuid, p_assignment jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(old_link_id uuid, new_link_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_old public.ps_event_collaborators%rowtype; v_new_id uuid; v_name text;
BEGIN
  SELECT * INTO v_old FROM public.ps_event_collaborators WHERE id=p_old_link_id FOR UPDATE;
  IF NOT FOUND OR v_old.participation_status='replaced' THEN RAISE EXCEPTION 'invalid_replacement_source'; END IF;
  IF EXISTS (SELECT 1 FROM public.ps_event_collaborators WHERE event_id=v_old.event_id AND collaborator_id=p_new_collaborator_id) THEN RAISE EXCEPTION 'collaborator_already_linked'; END IF;
  SELECT full_name INTO v_name FROM public.ps_collaborators WHERE id=p_new_collaborator_id AND active=true;
  IF v_name IS NULL THEN RAISE EXCEPTION 'active_replacement_not_found'; END IF;
  INSERT INTO public.ps_event_collaborators(event_id,collaborator_id,collaborator_name,role_value,role_name,assigned_role,pay_value,unit,building,floor,room,work_schedule,participation_status,replacement_for_event_collaborator_id,original_event_collaborator_id)
  VALUES(v_old.event_id,p_new_collaborator_id,v_name,
    coalesce(p_assignment->>'role_value',v_old.role_value),coalesce(p_assignment->>'role_name',v_old.role_name),coalesce(p_assignment->>'assigned_role',v_old.assigned_role),coalesce((p_assignment->>'pay_value')::numeric,v_old.pay_value),
    coalesce(p_assignment->>'unit',v_old.unit),coalesce(p_assignment->>'building',v_old.building),coalesce(p_assignment->>'floor',v_old.floor),coalesce(p_assignment->>'room',v_old.room),coalesce(p_assignment->>'work_schedule',v_old.work_schedule),
    'pending_confirmation',v_old.id,coalesce(v_old.original_event_collaborator_id,v_old.id)) RETURNING id INTO v_new_id;
  UPDATE public.ps_event_collaborators SET participation_status='replaced',public_confirmation_token_revoked_at=now() WHERE id=v_old.id;
  RETURN QUERY SELECT v_old.id,v_new_id;
END $$;
REVOKE ALL ON FUNCTION public.ps_replace_event_collaborator(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_replace_event_collaborator(uuid, uuid, jsonb) TO authenticated;

CREATE OR REPLACE TRIGGER ps_event_collaborators_confirmation_broadcast
AFTER UPDATE OF participation_status, confirmation_requested_at, confirmed_at, declined_at, decline_reason,
  replacement_for_event_collaborator_id, original_event_collaborator_id
ON public.ps_event_collaborators
FOR EACH ROW EXECUTE FUNCTION public.ps_event_collaborators_realtime_broadcast();
