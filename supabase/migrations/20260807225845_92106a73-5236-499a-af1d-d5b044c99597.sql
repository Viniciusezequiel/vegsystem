
-- reservations: internal staff see all; external portal users only their own
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;
CREATE POLICY "Internal staff or owner can view reservations"
ON public.reservations FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR requester_email = auth.email()
  OR created_by = auth.uid()
);

-- reservation_reschedulings
DROP POLICY IF EXISTS "Authenticated users can view reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Internal staff or owner can view reschedulings"
ON public.reservation_reschedulings FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_reschedulings.reservation_id
      AND (r.requester_email = auth.email() OR r.created_by = auth.uid())
  )
);

-- tasks and related
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
CREATE POLICY "Internal staff can view tasks"
ON public.tasks FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.task_comments;
CREATE POLICY "Internal staff can view task comments"
ON public.task_comments FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view task history" ON public.task_history;
CREATE POLICY "Internal staff can view task history"
ON public.task_history FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view task team members" ON public.task_team_members;
CREATE POLICY "Internal staff can view task team members"
ON public.task_team_members FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- checklists
DROP POLICY IF EXISTS "Authenticated users can view room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can view room checklists"
ON public.room_checklists FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can view checklist answers"
ON public.checklist_answers FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view checklist questions" ON public.checklist_questions;
CREATE POLICY "Internal staff can view checklist questions"
ON public.checklist_questions FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- semester projectors
DROP POLICY IF EXISTS "auth view projectors" ON public.semester_projectors;
CREATE POLICY "Internal staff can view projectors"
ON public.semester_projectors FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- inventory
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
CREATE POLICY "Internal staff can view equipment"
ON public.equipment FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view lockers" ON public.lockers;
CREATE POLICY "Internal staff can view lockers"
ON public.lockers FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;
CREATE POLICY "Internal staff can view rooms"
ON public.rooms FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- settings and permission matrix
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;
CREATE POLICY "Internal staff can read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.role_permissions;
CREATE POLICY "Internal staff can view permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));
