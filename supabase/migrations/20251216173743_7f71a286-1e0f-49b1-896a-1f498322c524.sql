-- =============================================
-- FIX profiles RLS: Allow internal users to view all profiles
-- (needed for assignee dropdown in tasks and other modules)
-- =============================================

-- Drop restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy allowing all internal users to view profiles
CREATE POLICY "Internal users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- =============================================
-- FIX tasks UPDATE: Allow all internal users to update tasks
-- (so supervisors and assistentes can also change assignee)
-- =============================================

-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Admins and analistas can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.tasks;

-- Create new policy allowing all internal users to update tasks
CREATE POLICY "Internal users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);