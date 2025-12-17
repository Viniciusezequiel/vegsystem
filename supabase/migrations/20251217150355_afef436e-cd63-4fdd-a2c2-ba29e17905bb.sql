-- Allow external users to cancel their own reservations
CREATE POLICY "External users can cancel their own reservations" 
ON public.reservations 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_external = true 
  AND requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_external = true 
  AND status = 'cancelled'
);