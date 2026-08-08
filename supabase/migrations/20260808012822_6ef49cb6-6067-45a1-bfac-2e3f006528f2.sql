
-- Anon-facing read policies must not call internal role helper functions
-- (anon has no EXECUTE on is_internal_user), which broke the public form.

DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.classroom_call_rooms;
CREATE POLICY "Public can view active rooms"
  ON public.classroom_call_rooms FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view rooms"
  ON public.classroom_call_rooms FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active issues" ON public.classroom_call_room_issues;
CREATE POLICY "Public can view active issues"
  ON public.classroom_call_room_issues FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view issues"
  ON public.classroom_call_room_issues FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active responses" ON public.classroom_call_responses;
CREATE POLICY "Public can view active responses"
  ON public.classroom_call_responses FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view responses"
  ON public.classroom_call_responses FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

GRANT SELECT ON public.classroom_call_rooms TO anon;
GRANT SELECT ON public.classroom_call_room_issues TO anon;
GRANT SELECT ON public.classroom_call_responses TO anon;
