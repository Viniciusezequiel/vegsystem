-- Drop existing INSERT policies first
DROP POLICY IF EXISTS "Admins and collaborators can insert external users" ON public.external_users;
DROP POLICY IF EXISTS "External users can insert their own profile" ON public.external_users;

-- Recreate as PERMISSIVE (default behavior - only ONE needs to be true)
CREATE POLICY "Admins and collaborators can insert external users" 
ON public.external_users 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "External users can insert their own profile" 
ON public.external_users 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);