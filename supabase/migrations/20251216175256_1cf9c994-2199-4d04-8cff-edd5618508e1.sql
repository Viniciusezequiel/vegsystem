-- =============================================
-- UPDATE tasks policy: admin, supervisor, assigned user, OR creator can update
-- =============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins or assigned users can update tasks" ON public.tasks;

-- Create new policy: admin, supervisor, assigned user, OR creator can update
CREATE POLICY "Admins or assigned users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor') OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid())
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor') OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid())
);