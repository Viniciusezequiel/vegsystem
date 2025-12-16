-- Allow all authenticated users to insert tasks
CREATE POLICY "All authenticated users can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view all tasks (not just assigned ones)
DROP POLICY IF EXISTS "Assigned users can view their tasks" ON public.tasks;

CREATE POLICY "Authenticated users can view all tasks"
ON public.tasks
FOR SELECT
USING (auth.uid() IS NOT NULL);