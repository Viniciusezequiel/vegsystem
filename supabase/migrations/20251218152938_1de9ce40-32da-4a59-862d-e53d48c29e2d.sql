-- Fix RLS policy for external users cancelling reservations
-- Use auth.email() directly instead of subquery to auth.users
DROP POLICY IF EXISTS "External users can cancel their own reservations" ON public.reservations;

CREATE POLICY "External users can cancel their own reservations" 
ON public.reservations 
FOR UPDATE 
TO authenticated
USING (
  is_external = true 
  AND lower(requester_email) = lower(auth.email())
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  is_external = true 
  AND status = 'cancelled'
);