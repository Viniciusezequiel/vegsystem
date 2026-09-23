ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS manually_excluded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_excluded_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_exclusion_reason text;

CREATE INDEX IF NOT EXISTS ps_event_collaborators_manual_exclusion_idx
  ON public.ps_event_collaborators (event_id, manually_excluded);
