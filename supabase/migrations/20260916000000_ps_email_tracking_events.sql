CREATE TABLE IF NOT EXISTS public.ps_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid REFERENCES public.ps_event_communications(id) ON DELETE CASCADE,
  provider_message_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ps_email_events_provider_message_idx
  ON public.ps_email_events(provider_message_id);

CREATE INDEX IF NOT EXISTS ps_email_events_communication_idx
  ON public.ps_email_events(communication_id);

ALTER TABLE public.ps_email_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_email_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ps_email_events TO service_role;
