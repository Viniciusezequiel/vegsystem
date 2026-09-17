-- Preserve inactive collaborators and their history, but prevent new event assignments.
CREATE OR REPLACE FUNCTION public.ps_block_inactive_event_collaborator_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.collaborator_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.ps_collaborators collaborator
       WHERE collaborator.id = NEW.collaborator_id
         AND collaborator.active = true
     ) THEN
    RAISE EXCEPTION 'Colaborador inativo não pode ser vinculado ao evento.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_block_inactive_event_collaborator_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ps_block_inactive_event_collaborator_link
  ON public.ps_event_collaborators;

CREATE TRIGGER ps_block_inactive_event_collaborator_link
BEFORE INSERT OR UPDATE OF collaborator_id
ON public.ps_event_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.ps_block_inactive_event_collaborator_link();

