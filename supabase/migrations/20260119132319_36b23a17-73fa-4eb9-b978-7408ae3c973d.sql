-- Add box_number column to lost_items table
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS box_number text;

-- Add box_number column to lost_items_archive table
ALTER TABLE public.lost_items_archive ADD COLUMN IF NOT EXISTS box_number text;

-- Add force_password_change column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;