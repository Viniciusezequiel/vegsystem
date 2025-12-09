-- Drop the overly permissive SELECT policy on equipment_loans
DROP POLICY IF EXISTS "Authenticated users can view equipment loans" ON public.equipment_loans;

-- Create a more restrictive SELECT policy - only admins and collaborators can view
CREATE POLICY "Admins and collaborators can view equipment loans" 
ON public.equipment_loans 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Also fix locker_loans which has the same issue
DROP POLICY IF EXISTS "Authenticated users can view locker loans" ON public.locker_loans;

CREATE POLICY "Admins and collaborators can view locker loans" 
ON public.locker_loans 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));