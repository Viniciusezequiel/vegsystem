-- =============================================
-- UPDATE tasks POLICIES
-- =============================================

-- Drop existing ALL policy that gives too many permissions
DROP POLICY IF EXISTS "Admins and analistas can manage tasks" ON public.tasks;

-- Keep existing INSERT policy for all authenticated users (already exists)
-- "All authenticated users can create tasks"

-- Create UPDATE policy for admins and analistas (replacing the ALL policy)
CREATE POLICY "Admins and analistas can update all tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role)
);

-- Create DELETE policy for admins only
CREATE POLICY "Only admins can delete tasks" 
ON public.tasks 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));