-- Fix material_requests SELECT policy to include supervisor (they may need to see team requests)
DROP POLICY IF EXISTS "Users can view their own requests" ON material_requests;

CREATE POLICY "Users can view material requests" 
ON material_requests FOR SELECT 
TO authenticated
USING (
  auth.uid() = requester_id OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Allow supervisors to manage requests (update status for their team)
DROP POLICY IF EXISTS "Admins and analistas can manage requests" ON material_requests;

CREATE POLICY "Internal managers can manage requests" 
ON material_requests FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);