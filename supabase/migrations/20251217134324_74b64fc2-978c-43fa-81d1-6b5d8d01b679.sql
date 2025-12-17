-- Add return_signature column to equipment_loans table
ALTER TABLE public.equipment_loans 
ADD COLUMN return_signature text;