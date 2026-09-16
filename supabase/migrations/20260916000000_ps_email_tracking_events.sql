ALTER TABLE public.ps_event_communications
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_last_event text,
  ADD COLUMN IF NOT EXISTS provider_last_event_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ps_event_communications_delivery_status_check'
      AND conrelid = 'public.ps_event_communications'::regclass
  ) THEN
    ALTER TABLE public.ps_event_communications
      ADD CONSTRAINT ps_event_communications_delivery_status_check
      CHECK (delivery_status IS NULL OR delivery_status IN (
        'sent','delivered','opened','clicked','deferred','soft_bounce',
        'hard_bounce','blocked','spam','invalid','error','unsubscribed','unknown'
      ));
  END IF;
END $$;

UPDATE public.ps_event_communications
SET delivery_status = CASE
  WHEN status = 'sent' THEN 'sent'
  WHEN status IN ('failed','failed_missing_recipient') THEN 'error'
  ELSE delivery_status
END
WHERE delivery_status IS NULL;

CREATE TABLE IF NOT EXISTS public.ps_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid REFERENCES public.ps_event_communications(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  provider_event_id text,
  event_type text NOT NULL,
  recipient_email text,
  event_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ps_email_events_provider_message_idx
  ON public.ps_email_events(provider_message_id);
CREATE INDEX IF NOT EXISTS ps_email_events_communication_idx
  ON public.ps_email_events(communication_id, event_at DESC);

ALTER TABLE public.ps_email_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ps_email_events'
      AND policyname = 'ps email events internal read'
  ) THEN
    CREATE POLICY "ps email events internal read"
      ON public.ps_email_events FOR SELECT TO authenticated
      USING (public.is_internal_user((SELECT auth.uid())));
  END IF;
END $$;

REVOKE ALL ON public.ps_email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ps_email_events TO authenticated;
GRANT SELECT, INSERT ON public.ps_email_events TO service_role;

CREATE OR REPLACE FUNCTION public.ps_record_email_provider_event(
  p_provider_message_id text,
  p_event_type text,
  p_event_at timestamptz,
  p_provider_event_id text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_communication public.ps_event_communications%ROWTYPE;
  v_event text := lower(regexp_replace(coalesce(p_event_type, ''), '[^a-zA-Z]', '', 'g'));
  v_status text;
  v_current_priority integer;
  v_new_priority integer;
  v_event_at timestamptz := coalesce(p_event_at, now());
  v_dedupe_key text;
BEGIN
  IF nullif(trim(p_provider_message_id), '') IS NULL THEN
    RAISE EXCEPTION 'missing_provider_message_id';
  END IF;

  SELECT * INTO v_communication
  FROM public.ps_event_communications
  WHERE provider_message_id = p_provider_message_id
     OR trim(both '<>' from provider_message_id) = trim(both '<>' from p_provider_message_id)
  ORDER BY requested_at DESC
  LIMIT 1;

  IF v_communication.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_status := CASE v_event
    WHEN 'request' THEN 'sent'
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'opened' THEN 'opened'
    WHEN 'uniqueopened' THEN 'opened'
    WHEN 'proxyopen' THEN 'opened'
    WHEN 'uniqueproxyopen' THEN 'opened'
    WHEN 'click' THEN 'clicked'
    WHEN 'clicked' THEN 'clicked'
    WHEN 'deferred' THEN 'deferred'
    WHEN 'softbounce' THEN 'soft_bounce'
    WHEN 'hardbounce' THEN 'hard_bounce'
    WHEN 'blocked' THEN 'blocked'
    WHEN 'spam' THEN 'spam'
    WHEN 'invalid' THEN 'invalid'
    WHEN 'error' THEN 'error'
    WHEN 'unsubscribed' THEN 'unsubscribed'
    ELSE 'unknown'
  END;

  v_dedupe_key := concat_ws(':',
    trim(both '<>' from p_provider_message_id),
    v_status,
    coalesce(nullif(p_provider_event_id, ''), extract(epoch from v_event_at)::text)
  );

  INSERT INTO public.ps_email_events (
    communication_id, provider_message_id, provider_event_id, event_type,
    recipient_email, event_at, dedupe_key, payload
  ) VALUES (
    v_communication.id, p_provider_message_id, p_provider_event_id, v_status,
    nullif(trim(p_recipient_email), ''), v_event_at, v_dedupe_key, coalesce(p_payload, '{}'::jsonb)
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  v_current_priority := CASE v_communication.delivery_status
    WHEN 'sent' THEN 20 WHEN 'delivered' THEN 30 WHEN 'opened' THEN 40 WHEN 'clicked' THEN 50
    WHEN 'deferred' THEN 10 WHEN 'soft_bounce' THEN 80 WHEN 'hard_bounce' THEN 100
    WHEN 'blocked' THEN 100 WHEN 'spam' THEN 100 WHEN 'invalid' THEN 100
    WHEN 'error' THEN 100 WHEN 'unsubscribed' THEN 90 ELSE 0 END;
  v_new_priority := CASE v_status
    WHEN 'sent' THEN 20 WHEN 'delivered' THEN 30 WHEN 'opened' THEN 40 WHEN 'clicked' THEN 50
    WHEN 'deferred' THEN 10 WHEN 'soft_bounce' THEN 80 WHEN 'hard_bounce' THEN 100
    WHEN 'blocked' THEN 100 WHEN 'spam' THEN 100 WHEN 'invalid' THEN 100
    WHEN 'error' THEN 100 WHEN 'unsubscribed' THEN 90 ELSE 0 END;

  UPDATE public.ps_event_communications
  SET delivery_status = CASE WHEN v_new_priority >= v_current_priority THEN v_status ELSE delivery_status END,
      delivered_at = CASE WHEN v_status IN ('delivered','opened','clicked') THEN coalesce(delivered_at, v_event_at) ELSE delivered_at END,
      opened_at = CASE WHEN v_status IN ('opened','clicked') THEN coalesce(opened_at, v_event_at) ELSE opened_at END,
      clicked_at = CASE WHEN v_status = 'clicked' THEN coalesce(clicked_at, v_event_at) ELSE clicked_at END,
      provider_last_event = v_status,
      provider_last_event_at = v_event_at,
      updated_at = now()
  WHERE id = v_communication.id;

  RETURN v_communication.id;
END $$;

REVOKE ALL ON FUNCTION public.ps_record_email_provider_event(text,text,timestamptz,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_record_email_provider_event(text,text,timestamptz,text,text,jsonb)
  TO service_role;

DROP TRIGGER IF EXISTS ps_event_communications_realtime_broadcast ON public.ps_event_communications;
CREATE TRIGGER ps_event_communications_realtime_broadcast
AFTER INSERT OR UPDATE OF status, attempt_count, sent_at, failed_at, delivery_status, delivered_at, opened_at, clicked_at
ON public.ps_event_communications
FOR EACH ROW EXECUTE FUNCTION public.ps_event_communications_realtime_broadcast();
