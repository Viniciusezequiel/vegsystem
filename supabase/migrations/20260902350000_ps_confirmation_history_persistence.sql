-- Preserva permanentemente o histórico de confirmações,
-- recusas e substituições mesmo se o vínculo original for removido.

ALTER TABLE public.ps_confirmation_history
  ADD COLUMN IF NOT EXISTS collaborator_name_snapshot text,
  ADD COLUMN IF NOT EXISTS role_name_snapshot text,
  ADD COLUMN IF NOT EXISTS campus_snapshot text,
  ADD COLUMN IF NOT EXISTS unit_snapshot text,
  ADD COLUMN IF NOT EXISTS building_snapshot text,
  ADD COLUMN IF NOT EXISTS floor_snapshot text,
  ADD COLUMN IF NOT EXISTS room_snapshot text,
  ADD COLUMN IF NOT EXISTS replacement_collaborator_name_snapshot text;


-- Preenche snapshots dos registros já existentes.
UPDATE public.ps_confirmation_history h
SET
  collaborator_name_snapshot =
    coalesce(h.collaborator_name_snapshot, ec.collaborator_name),
  role_name_snapshot =
    coalesce(
      h.role_name_snapshot,
      ec.role_name,
      ec.assigned_role
    ),
  campus_snapshot =
    coalesce(h.campus_snapshot, ec.campus),
  unit_snapshot =
    coalesce(h.unit_snapshot, ec.unit),
  building_snapshot =
    coalesce(h.building_snapshot, ec.building),
  floor_snapshot =
    coalesce(h.floor_snapshot, ec.floor),
  room_snapshot =
    coalesce(h.room_snapshot, ec.room)
FROM public.ps_event_collaborators ec
WHERE h.event_collaborator_id = ec.id;


UPDATE public.ps_confirmation_history h
SET
  replacement_collaborator_name_snapshot =
    coalesce(
      h.replacement_collaborator_name_snapshot,
      ec.collaborator_name
    )
FROM public.ps_event_collaborators ec
WHERE h.replacement_event_collaborator_id = ec.id;


-- O histórico não deve desaparecer se o vínculo for removido.
ALTER TABLE public.ps_confirmation_history
  DROP CONSTRAINT IF EXISTS
  ps_confirmation_history_event_collaborator_id_fkey;

ALTER TABLE public.ps_confirmation_history
  ALTER COLUMN event_collaborator_id DROP NOT NULL;

ALTER TABLE public.ps_confirmation_history
  ADD CONSTRAINT
  ps_confirmation_history_event_collaborator_id_fkey
  FOREIGN KEY (event_collaborator_id)
  REFERENCES public.ps_event_collaborators(id)
  ON DELETE SET NULL;


-- Atualiza o trigger para salvar snapshots.
CREATE OR REPLACE FUNCTION public.ps_record_confirmation_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_replacement_id uuid;
  v_replacement_name text;
BEGIN
  IF NEW.participation_status
     IS DISTINCT FROM OLD.participation_status THEN

    IF NEW.participation_status = 'replaced' THEN
      SELECT
        ec.id,
        ec.collaborator_name
      INTO
        v_replacement_id,
        v_replacement_name
      FROM public.ps_event_collaborators ec
      WHERE ec.replacement_for_event_collaborator_id = NEW.id
      ORDER BY ec.created_at DESC
      LIMIT 1;
    END IF;

    INSERT INTO public.ps_confirmation_history (
      event_id,
      event_collaborator_id,
      previous_status,
      new_status,
      decline_reason,
      replacement_event_collaborator_id,
      source,
      actor_name,
      collaborator_name_snapshot,
      role_name_snapshot,
      campus_snapshot,
      unit_snapshot,
      building_snapshot,
      floor_snapshot,
      room_snapshot,
      replacement_collaborator_name_snapshot
    )
    VALUES (
      NEW.event_id,
      NEW.id,
      OLD.participation_status,
      NEW.participation_status,
      NEW.decline_reason,
      v_replacement_id,
      'system',
      NEW.collaborator_name,
      NEW.collaborator_name,
      coalesce(NEW.role_name, NEW.assigned_role),
      NEW.campus,
      NEW.unit,
      NEW.building,
      NEW.floor,
      NEW.room,
      v_replacement_name
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.ps_record_confirmation_history()
FROM PUBLIC;
