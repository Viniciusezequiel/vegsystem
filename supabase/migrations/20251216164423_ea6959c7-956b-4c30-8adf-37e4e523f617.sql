-- Drop existing policies on locker_loans
DROP POLICY IF EXISTS "Admins and analistas can insert locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and analistas can update locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and analistas can view locker loans" ON public.locker_loans;

-- Create new policies that include assistente and supervisor
CREATE POLICY "Internal users can insert locker loans" 
ON public.locker_loans 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update locker loans" 
ON public.locker_loans 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can view locker loans" 
ON public.locker_loans 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Also need to allow internal users to update lockers status
DROP POLICY IF EXISTS "Admins and analistas can update lockers" ON public.lockers;

CREATE POLICY "Internal users can update lockers" 
ON public.lockers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);