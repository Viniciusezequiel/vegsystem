-- Fix: Restrict lost_items SELECT access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view lost items" ON public.lost_items;

CREATE POLICY "Authenticated users can view lost items" 
ON public.lost_items 
FOR SELECT 
USING (auth.uid() IS NOT NULL);