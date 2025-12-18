-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;
DROP POLICY IF EXISTS "Internal users can view external requests" ON public.external_equipment_requests;

-- Create permissive SELECT policies (OR logic instead of AND)
CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  lower(requester_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "Internal users can view all external requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);