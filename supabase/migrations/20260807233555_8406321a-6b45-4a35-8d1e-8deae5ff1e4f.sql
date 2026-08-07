-- Semester module: restrict reads to internal staff
DROP POLICY IF EXISTS "auth view items" ON public.semester_checklist_items;
CREATE POLICY "internal view items" ON public.semester_checklist_items
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view checklists" ON public.semester_checklists;
CREATE POLICY "internal view checklists" ON public.semester_checklists
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view competencies" ON public.semester_competencies;
CREATE POLICY "internal view competencies" ON public.semester_competencies
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view furniture" ON public.semester_furniture_details;
CREATE POLICY "internal view furniture" ON public.semester_furniture_details
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view options" ON public.semester_item_options;
CREATE POLICY "Internal staff can view options" ON public.semester_item_options
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view labels" ON public.semester_labels;
CREATE POLICY "internal view labels" ON public.semester_labels
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth insert labels" ON public.semester_labels;
CREATE POLICY "internal insert labels" ON public.semester_labels
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

-- Room combinations: internal staff only (public pages use SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Anyone can view room combinations" ON public.room_combinations;
CREATE POLICY "Internal staff can view room combinations" ON public.room_combinations
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
REVOKE SELECT ON public.room_combinations FROM anon;

-- Uber requests: internal staff only
DROP POLICY IF EXISTS "Anyone can create uber requests" ON public.uber_requests;
CREATE POLICY "Internal staff can create uber requests" ON public.uber_requests
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));
REVOKE ALL ON public.uber_requests FROM anon;