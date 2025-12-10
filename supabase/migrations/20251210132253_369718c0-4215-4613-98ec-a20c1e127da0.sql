-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view reservations" 
ON public.reservations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);