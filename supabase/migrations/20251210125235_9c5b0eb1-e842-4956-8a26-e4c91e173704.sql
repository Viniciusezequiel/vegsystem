-- Add assigned_to column to material_requests table
ALTER TABLE public.material_requests
ADD COLUMN assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN assigned_to_name text;

-- Add index for better performance
CREATE INDEX idx_material_requests_assigned_to ON public.material_requests(assigned_to);