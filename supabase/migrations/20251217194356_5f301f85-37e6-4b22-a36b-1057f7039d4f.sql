-- Add RLS policy to allow external users to view their own equipment requests
CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
USING (
  requester_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )::text
);