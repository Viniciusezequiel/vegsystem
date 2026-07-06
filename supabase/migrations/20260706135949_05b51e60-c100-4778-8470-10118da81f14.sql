
-- Add creator, filler and projector-confirmation tracking to semester_checklists
ALTER TABLE public.semester_checklists
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS filled_by_id uuid,
  ADD COLUMN IF NOT EXISTS filled_by_name text,
  ADD COLUMN IF NOT EXISTS filled_at timestamptz,
  ADD COLUMN IF NOT EXISTS projectors_confirmed boolean NOT NULL DEFAULT false;
