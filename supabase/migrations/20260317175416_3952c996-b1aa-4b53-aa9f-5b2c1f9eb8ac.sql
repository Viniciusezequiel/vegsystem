-- Update the tasks UPDATE RLS policy to also allow team members to update
DROP POLICY IF EXISTS "Admins or assigned users can update tasks" ON public.tasks;

CREATE POLICY "Admins or assigned users can update tasks"
ON public.tasks
FOR UPDATE
TO public
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR (assigned_to = auth.uid()) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_team_members 
    WHERE task_team_members.task_id = tasks.id 
    AND task_team_members.user_id = auth.uid()
  )
)
WITH CHECK (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR (assigned_to = auth.uid()) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_team_members 
    WHERE task_team_members.task_id = tasks.id 
    AND task_team_members.user_id = auth.uid()
  )
);