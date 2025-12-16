-- =============================================
-- UPDATE equipment_loans POLICIES
-- =============================================

-- Drop existing restrictive policies on equipment_loans
DROP POLICY IF EXISTS "Admins and analistas can insert equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and analistas can update equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and analistas can view equipment loans" ON public.equipment_loans;

-- Create new policies for all internal users
CREATE POLICY "Internal users can insert equipment loans" 
ON public.equipment_loans 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update equipment loans" 
ON public.equipment_loans 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can view equipment loans" 
ON public.equipment_loans 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- =============================================
-- UPDATE lost_items POLICIES
-- =============================================

-- Drop existing restrictive policies on lost_items
DROP POLICY IF EXISTS "Internal users can insert lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Admins and analistas can update lost items" ON public.lost_items;

-- Create new policies for all internal users
CREATE POLICY "Internal users can insert lost items" 
ON public.lost_items 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update lost items" 
ON public.lost_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);