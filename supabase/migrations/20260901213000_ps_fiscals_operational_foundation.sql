-- Fundação operacional incremental do banco central de fiscais.
-- ps_collaborators.id permanece a identidade relacional canônica.

ALTER TABLE public.ps_collaborators
  ADD COLUMN IF NOT EXISTS email_normalized text
  GENERATED ALWAYS AS (NULLIF(lower(trim(email)), '')) STORED,
  ADD COLUMN IF NOT EXISTS matricula_normalized text
  GENERATED ALWAYS AS (NULLIF(lower(trim(matricula)), '')) STORED,
  ADD COLUMN IF NOT EXISTS institution_normalized text
  GENERATED ALWAYS AS (NULLIF(lower(regexp_replace(trim(institution), '\s+', ' ', 'g')), '')) STORED;

COMMENT ON COLUMN public.ps_collaborators.email_normalized IS
  'Identificador conservador para conciliação: trim + lowercase.';
COMMENT ON COLUMN public.ps_collaborators.matricula_normalized IS
  'Fallback de conciliação; usar somente junto de institution_normalized.';

CREATE UNIQUE INDEX IF NOT EXISTS ps_collaborators_email_normalized_unique
  ON public.ps_collaborators (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ps_collaborators_matricula_institution_unique
  ON public.ps_collaborators (matricula_normalized, institution_normalized)
  WHERE matricula_normalized IS NOT NULL AND institution_normalized IS NOT NULL;

ALTER TABLE public.ps_event_collaborators
  ADD CONSTRAINT ps_event_collaborators_presence_consistent
  CHECK (NOT (present AND absent)) NOT VALID;
ALTER TABLE public.ps_event_collaborators
  VALIDATE CONSTRAINT ps_event_collaborators_presence_consistent;

ALTER TABLE public.ps_event_collaborators
  ADD CONSTRAINT ps_event_collaborators_collaborator_required
  CHECK (collaborator_id IS NOT NULL) NOT VALID;
ALTER TABLE public.ps_event_collaborators
  VALIDATE CONSTRAINT ps_event_collaborators_collaborator_required;

-- RLS e políticas existentes permanecem inalteradas.
