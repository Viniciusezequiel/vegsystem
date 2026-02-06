
-- Create equipment_reservations table for pre-scheduling
CREATE TABLE public.equipment_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  quantity_reserved INTEGER NOT NULL DEFAULT 1,
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  requester_sector TEXT NOT NULL,
  requester_type TEXT NOT NULL DEFAULT 'aluno',
  purpose TEXT,
  scheduled_pickup_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_pickup',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Internal users can view equipment reservations"
ON public.equipment_reservations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can insert equipment reservations"
ON public.equipment_reservations
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update equipment reservations"
ON public.equipment_reservations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Only admins can delete equipment reservations"
ON public.equipment_reservations
FOR DELETE
USING (is_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_reservations;
