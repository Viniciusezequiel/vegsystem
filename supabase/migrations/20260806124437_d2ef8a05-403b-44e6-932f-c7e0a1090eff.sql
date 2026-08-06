ALTER TABLE public.ps_collaborators
  ADD COLUMN IF NOT EXISTS identity_doc text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS preferred_role text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS role_value text,
  ADD COLUMN IF NOT EXISTS role_name text,
  ADD COLUMN IF NOT EXISTS pay_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS present boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS identity_doc text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS deposit_info text,
  ADD COLUMN IF NOT EXISTS pix text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS import_tag text;

CREATE UNIQUE INDEX IF NOT EXISTS ps_collaborators_cpf_unique
  ON public.ps_collaborators (cpf) WHERE cpf IS NOT NULL AND cpf <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ps_event_collaborators_event_collab_unique
  ON public.ps_event_collaborators (event_id, collaborator_id) WHERE collaborator_id IS NOT NULL;