-- Internal trigger infrastructure only. Do not revoke legitimate public/admin RPCs.
-- Preserve function owners, SECURITY DEFINER bodies and existing trigger bindings.
-- The broadcast trigger invokes the roster helper with its owner's privileges;
-- existing triggers do not require EXECUTE granted to the role modifying the row.
-- Explicit role revokes also remove grants left by earlier default privileges.
BEGIN;

REVOKE ALL ON FUNCTION public.ps_notify_event_roster_changed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_notify_event_roster_changed(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ps_notify_event_roster_changed(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.ps_event_collaborators_realtime_broadcast() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_event_collaborators_realtime_broadcast() FROM anon;
REVOKE ALL ON FUNCTION public.ps_event_collaborators_realtime_broadcast() FROM authenticated;

REVOKE ALL ON FUNCTION public.ps_record_confirmation_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_record_confirmation_history() FROM anon;
REVOKE ALL ON FUNCTION public.ps_record_confirmation_history() FROM authenticated;

COMMIT;
