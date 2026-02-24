-- Drop the existing policy
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;

-- Create updated policy with case-insensitive comparison
CREATE POLICY "External users can view their own equipment requests" 
ON public.external_equipment_requests 
FOR SELECT 
USING (
  lower(requester_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
);