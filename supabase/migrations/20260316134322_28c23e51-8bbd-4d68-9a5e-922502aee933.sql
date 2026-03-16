
-- Allow anonymous/public inserts to classroom_calls (external form)
CREATE POLICY "Anyone can create classroom calls from external form"
ON public.classroom_calls
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
