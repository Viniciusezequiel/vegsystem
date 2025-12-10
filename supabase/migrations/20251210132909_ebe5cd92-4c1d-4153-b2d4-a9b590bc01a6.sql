-- Update the reservations INSERT policy to require authentication for direct inserts
-- External reservations will go through the edge function which uses service role

DROP POLICY IF EXISTS "Anyone can insert reservations" ON public.reservations;

-- Only authenticated users can insert reservations directly
CREATE POLICY "Authenticated users can insert reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);