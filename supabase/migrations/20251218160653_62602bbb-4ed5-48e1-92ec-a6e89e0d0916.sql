-- Update RLS policy to allow external users to reschedule their equipment requests
DROP POLICY IF EXISTS "External users can cancel their own equipment requests" ON public.external_equipment_requests;

CREATE POLICY "External users can update their own equipment requests" 
ON public.external_equipment_requests 
FOR UPDATE 
USING (
  (lower(requester_email) = lower(auth.email())) 
  AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'awaiting_pickup'::text]))
)
WITH CHECK (
  (status = ANY (ARRAY['pending'::text, 'cancelled'::text]))
);