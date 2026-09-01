CREATE OR REPLACE FUNCTION public.ps_notify_event_roster_changed(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object(
      'event_id', p_event_id,
      'resource', 'event_collaborators',
      'action', 'changed'
    ),
    'roster_changed',
    'ps:event:' || p_event_id,
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ps_event_collaborators_realtime_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  v_event_id := COALESCE(NEW.event_id, OLD.event_id);

  IF v_event_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM public.ps_notify_event_roster_changed(v_event_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ps_event_collaborators_realtime_broadcast ON public.ps_event_collaborators;
CREATE TRIGGER ps_event_collaborators_realtime_broadcast
AFTER INSERT OR UPDATE OF event_id, collaborator_id, collaborator_name, assigned_role, role_name, sector, present, absent, signed_at, departed_at, room, building, floor, unit, institution, work_schedule OR DELETE
ON public.ps_event_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.ps_event_collaborators_realtime_broadcast();

REVOKE ALL ON FUNCTION public.ps_notify_event_roster_changed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_event_collaborators_realtime_broadcast() FROM PUBLIC;
