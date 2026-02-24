-- Fix equipment UPDATE policy to allow all internal users to toggle external loan
DROP POLICY IF EXISTS "Admins and analistas can update equipment" ON equipment;

CREATE POLICY "Internal users can update equipment" 
ON equipment 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Fix material_requests SELECT policy - ensure it's PERMISSIVE (default) not RESTRICTIVE
DROP POLICY IF EXISTS "Users can view their own requests" ON material_requests;

CREATE POLICY "Users can view their own requests" 
ON material_requests 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = requester_id OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role)
);

-- Also ensure internal users can view ALL material requests (for admins/analistas managing them)
-- The above policy already handles this

-- Fix inventory_movements to allow all internal users
DROP POLICY IF EXISTS "Admins and analistas can insert inventory movements" ON inventory_movements;

CREATE POLICY "Internal users can insert inventory movements" 
ON inventory_movements 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

DROP POLICY IF EXISTS "Admins and analistas can update inventory movements" ON inventory_movements;

CREATE POLICY "Internal users can update inventory movements" 
ON inventory_movements 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);