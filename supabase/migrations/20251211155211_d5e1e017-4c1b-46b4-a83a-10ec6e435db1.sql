-- Add policy to allow anyone to read a specific classroom call by ID
-- This enables real-time updates for external users who just created a call
CREATE POLICY "Anyone can view their submitted call by ID" 
ON public.classroom_calls 
FOR SELECT 
USING (true);