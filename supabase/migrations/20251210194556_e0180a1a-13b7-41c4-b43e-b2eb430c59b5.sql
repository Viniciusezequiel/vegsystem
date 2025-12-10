-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins and collaborators can manage external users" ON public.external_users;

-- Create separate policies for each operation
CREATE POLICY "Admins and collaborators can insert external users" 
ON public.external_users 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can update external users" 
ON public.external_users 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can delete external users" 
ON public.external_users 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));