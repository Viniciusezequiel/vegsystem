-- =============================================
-- FIX tasks UPDATE: Only admin OR assigned user can update
-- =============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Internal users can update tasks" ON public.tasks;

-- Create new policy: only admin OR the assigned user can update
CREATE POLICY "Admins or assigned users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  is_admin(auth.uid()) OR 
  (assigned_to = auth.uid())
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  (assigned_to = auth.uid())
);