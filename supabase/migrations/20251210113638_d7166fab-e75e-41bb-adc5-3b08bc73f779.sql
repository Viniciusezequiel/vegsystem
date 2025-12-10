-- Add is_fixed column to reservations for fixed reservations (recurring)
ALTER TABLE public.reservations 
ADD COLUMN is_fixed boolean NOT NULL DEFAULT false;