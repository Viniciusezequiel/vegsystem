-- Add allow_external_loan field to equipment table
ALTER TABLE public.equipment 
ADD COLUMN IF NOT EXISTS allow_external_loan boolean NOT NULL DEFAULT true;

-- Add write-off related fields to equipment
ALTER TABLE public.equipment 
ADD COLUMN IF NOT EXISTS write_off_date date,
ADD COLUMN IF NOT EXISTS write_off_reason text,
ADD COLUMN IF NOT EXISTS write_off_by uuid;

-- Create inventory_movements table for tracking transfers and other movements
CREATE TABLE public.inventory_movements (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    movement_type text NOT NULL CHECK (movement_type IN ('transfer', 'write_off', 'import', 'adjustment')),
    from_location text,
    to_location text,
    from_campus text,
    to_campus text,
    quantity integer NOT NULL DEFAULT 1,
    reason text,
    notes text,
    performed_by uuid,
    performed_by_name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_movements
CREATE POLICY "Internal users can view inventory movements" 
ON public.inventory_movements 
FOR SELECT 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Admins and analistas can insert inventory movements" 
ON public.inventory_movements 
FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Admins and analistas can update inventory movements" 
ON public.inventory_movements 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Only admins can delete inventory movements" 
ON public.inventory_movements 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create index for better performance
CREATE INDEX idx_inventory_movements_equipment_id ON public.inventory_movements(equipment_id);
CREATE INDEX idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);