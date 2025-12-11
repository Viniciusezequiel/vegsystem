-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can create classroom calls" ON public.classroom_calls;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can create classroom calls" 
ON public.classroom_calls 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);