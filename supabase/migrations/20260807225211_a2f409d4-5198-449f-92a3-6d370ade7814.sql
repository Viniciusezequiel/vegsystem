-- 1) Remove implicit PUBLIC execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) FROM PUBLIC;

-- helpers no client should call directly
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM anon, authenticated;

-- room availability is used by the signed-in app only
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon;

-- role predicates are only needed by anon while evaluating anon-visible policies,
-- which are scoped to authenticated below; revoke anon execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM anon;

-- 2) Scope internal-management policies on anon-readable tables to authenticated
DROP POLICY IF EXISTS "Internal users can manage rooms" ON public.classroom_call_rooms;
CREATE POLICY "Internal users can manage rooms" ON public.classroom_call_rooms
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can manage issues" ON public.classroom_call_room_issues;
CREATE POLICY "Internal users can manage issues" ON public.classroom_call_room_issues
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can manage responses" ON public.classroom_call_responses;
CREATE POLICY "Internal users can manage responses" ON public.classroom_call_responses
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and analistas can manage rooms" ON public.reservation_rooms;
CREATE POLICY "Admins and analistas can manage rooms" ON public.reservation_rooms
  FOR ALL TO authenticated
  USING (public.is_admin_or_analista(auth.uid()))
  WITH CHECK (public.is_admin_or_analista(auth.uid()));

-- 3) Realtime channel authorization: only internal staff may use realtime channels
DROP POLICY IF EXISTS "Internal users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Internal users can receive realtime messages" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can send realtime messages" ON realtime.messages;
CREATE POLICY "Internal users can send realtime messages" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

-- 4) Storage: no broad object listing on public buckets
DROP POLICY IF EXISTS "Authenticated users can view lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;

CREATE POLICY "Internal users can read task attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can read lost item images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));