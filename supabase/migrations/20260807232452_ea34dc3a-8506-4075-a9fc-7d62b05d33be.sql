-- Revoke broad EXECUTE from anon/public on all SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon, public;
REVOKE ALL ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_linked_rooms(uuid) FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_admin_or_analista(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.expire_old_lost_items() FROM anon, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.enforce_task_creator_fields() FROM anon, public, authenticated;

-- Keep internal helpers usable by signed-in users (needed by RLS policies and app queries)
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_lost_items() TO authenticated;

-- Explicitly keep the intentionally public endpoints callable by anonymous visitors
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated;

-- service_role keeps full access for edge functions / cron
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;