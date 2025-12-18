-- Allow external users to cancel their own equipment requests
CREATE POLICY "External users can cancel their own equipment requests"
ON public.external_equipment_requests
FOR UPDATE
TO authenticated
USING (
  lower(requester_email) = lower(auth.email())
  AND status IN ('pending', 'approved', 'awaiting_pickup')
)
WITH CHECK (
  status = 'cancelled'
);