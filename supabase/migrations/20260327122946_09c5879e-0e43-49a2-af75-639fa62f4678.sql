
-- Allow admins to delete checklist answers
CREATE POLICY "Admins can delete checklist answers"
ON public.checklist_answers FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Allow admins to delete room checklists
CREATE POLICY "Admins can delete room checklists"
ON public.room_checklists FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));
