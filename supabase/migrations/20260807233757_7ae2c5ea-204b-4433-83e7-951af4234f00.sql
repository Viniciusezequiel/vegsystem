-- Lost items: internal staff only
DROP POLICY IF EXISTS "Authenticated users can view lost items" ON public.lost_items;
CREATE POLICY "Internal staff can view lost items" ON public.lost_items
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

-- Tasks
DROP POLICY IF EXISTS "All authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Internal staff can create tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.task_comments;
CREATE POLICY "Internal staff can insert comments" ON public.task_comments
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;
CREATE POLICY "Internal staff can insert task history" ON public.task_history
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

-- Checklists
DROP POLICY IF EXISTS "Authenticated users can insert checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can insert checklist answers" ON public.checklist_answers
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can insert room checklists" ON public.room_checklists
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()) AND auth.uid() = filled_by);

-- Shift handovers
DROP POLICY IF EXISTS "Authenticated users can insert shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can insert shift handovers" ON public.shift_handovers
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()) AND auth.uid() = filled_by);

DROP POLICY IF EXISTS "Authenticated users can view shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can view shift handovers" ON public.shift_handovers
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can view shift handover incidents" ON public.shift_handover_incidents
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can insert shift handover incidents" ON public.shift_handover_incidents
FOR INSERT TO authenticated WITH CHECK (
  public.is_internal_user(auth.uid())
  AND EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id AND h.filled_by = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can view shift handover tasks" ON public.shift_handover_tasks
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can insert shift handover tasks" ON public.shift_handover_tasks
FOR INSERT TO authenticated WITH CHECK (
  public.is_internal_user(auth.uid())
  AND EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id AND h.filled_by = auth.uid())
);