ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS work_schedule text;

COMMENT ON COLUMN public.ps_event_collaborators.work_schedule IS
  'Horário operacional específico do vínculo dentro do evento. Não é persistido no cadastro mestre de ps_collaborators.';
