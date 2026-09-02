ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS confirmation_token_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ps_event_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  communication_type text NOT NULL CHECK (communication_type IN ('confirmation_request','event_message')),
  logical_recipient text,
  actual_recipient text,
  subject text NOT NULL,
  body_template text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waiting_provider_quota','processing','sent','failed','failed_missing_recipient','cancelled')),
  provider text,
  provider_message_id text,
  test_mode boolean NOT NULL DEFAULT true,
  provider_quota_date date,
  confirmation_token_version integer,
  idempotency_key text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processing_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS ps_event_communications_event_requested_idx ON public.ps_event_communications(event_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS ps_event_communications_event_status_idx ON public.ps_event_communications(event_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS ps_event_communications_confirmation_version_uidx
  ON public.ps_event_communications(event_collaborator_id, communication_type, confirmation_token_version)
  WHERE communication_type='confirmation_request' AND confirmation_token_version IS NOT NULL;

ALTER TABLE public.ps_event_communications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ps_event_communications' AND policyname='ps communications internal read') THEN
    CREATE POLICY "ps communications internal read" ON public.ps_event_communications FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
  END IF;
END $$;
REVOKE ALL ON public.ps_event_communications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ps_event_communications TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ps_event_communications TO service_role;

CREATE TABLE IF NOT EXISTS public.ps_email_daily_quota (
  provider text NOT NULL,
  quota_date date NOT NULL,
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,quota_date)
);
ALTER TABLE public.ps_email_daily_quota ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_email_daily_quota FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ps_email_daily_quota TO service_role;

CREATE OR REPLACE FUNCTION public.ps_reserve_email_daily_quota(p_provider text,p_quota_date date,p_daily_limit integer)
RETURNS TABLE(allowed boolean,daily_sent integer,available integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_reserved integer;v_sent integer;v_used integer;
BEGIN
  IF p_daily_limit<1 OR p_daily_limit>10000 OR nullif(trim(p_provider),'') IS NULL THEN RAISE EXCEPTION 'invalid_email_quota'; END IF;
  INSERT INTO public.ps_email_daily_quota(provider,quota_date) VALUES(lower(trim(p_provider)),p_quota_date) ON CONFLICT DO NOTHING;
  SELECT reserved_count INTO v_reserved FROM public.ps_email_daily_quota WHERE provider=lower(trim(p_provider)) AND quota_date=p_quota_date FOR UPDATE;
  SELECT count(*)::integer INTO v_sent FROM public.ps_event_communications WHERE provider=lower(trim(p_provider)) AND status='sent' AND test_mode=false AND (sent_at AT TIME ZONE 'UTC')::date=p_quota_date;
  v_used:=greatest(v_reserved,v_sent);
  IF v_used>=p_daily_limit THEN RETURN QUERY SELECT false,v_sent,0;RETURN;END IF;
  UPDATE public.ps_email_daily_quota SET reserved_count=v_used+1,updated_at=now() WHERE provider=lower(trim(p_provider)) AND quota_date=p_quota_date;
  RETURN QUERY SELECT true,v_sent,greatest(0,p_daily_limit-v_used-1);
END $$;
REVOKE ALL ON FUNCTION public.ps_reserve_email_daily_quota(text,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_reserve_email_daily_quota(text,date,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ps_release_email_daily_quota(p_provider text,p_quota_date date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_sent integer;
BEGIN
  SELECT count(*)::integer INTO v_sent FROM public.ps_event_communications WHERE provider=lower(trim(p_provider)) AND status='sent' AND test_mode=false AND (sent_at AT TIME ZONE 'UTC')::date=p_quota_date;
  UPDATE public.ps_email_daily_quota SET reserved_count=greatest(v_sent,reserved_count-1),updated_at=now() WHERE provider=lower(trim(p_provider)) AND quota_date=p_quota_date;
END $$;
REVOKE ALL ON FUNCTION public.ps_release_email_daily_quota(text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_release_email_daily_quota(text,date) TO service_role;

CREATE OR REPLACE FUNCTION public.ps_prepare_confirmation_communication(p_link_id uuid)
RETURNS TABLE(token text, token_version integer, expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,extensions,pg_temp AS $$
DECLARE v_token text; v_version integer; v_expires timestamptz;
BEGIN
  v_token:=encode(extensions.gen_random_bytes(32),'hex'); v_expires:=now()+interval '72 hours';
  UPDATE public.ps_event_collaborators SET participation_status='pending_confirmation', confirmation_requested_at=now(),
    confirmed_at=NULL,declined_at=NULL,decline_reason=NULL,
    confirmation_token_version=confirmation_token_version+1,
    public_confirmation_token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
    public_confirmation_token_expires_at=v_expires,public_confirmation_token_revoked_at=NULL
  WHERE id=p_link_id AND participation_status<>'replaced'
  RETURNING confirmation_token_version INTO v_version;
  IF v_version IS NULL THEN RAISE EXCEPTION 'invalid_confirmation_recipient'; END IF;
  RETURN QUERY SELECT v_token,v_version,v_expires;
END $$;
REVOKE ALL ON FUNCTION public.ps_prepare_confirmation_communication(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_prepare_confirmation_communication(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ps_event_communications_realtime_broadcast()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  PERFORM realtime.send(jsonb_build_object('event_id',NEW.event_id,'job_id',NEW.id,'status',NEW.status),'communications_changed','ps:event:'||NEW.event_id,false);
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER ps_event_communications_realtime_broadcast
AFTER INSERT OR UPDATE OF status,attempt_count,sent_at,failed_at ON public.ps_event_communications
FOR EACH ROW EXECUTE FUNCTION public.ps_event_communications_realtime_broadcast();
REVOKE ALL ON FUNCTION public.ps_event_communications_realtime_broadcast() FROM PUBLIC,anon,authenticated;
