
-- Add new fields to equipment_loans to match paper forms
ALTER TABLE public.equipment_loans
  ADD COLUMN IF NOT EXISTS borrower_type text DEFAULT 'aluno',
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS authorizer_name text,
  ADD COLUMN IF NOT EXISTS authorizer_contact text,
  ADD COLUMN IF NOT EXISTS collaborator_name text,
  ADD COLUMN IF NOT EXISTS return_collaborator_name text,
  ADD COLUMN IF NOT EXISTS returner_name text,
  ADD COLUMN IF NOT EXISTS returner_phone text,
  ADD COLUMN IF NOT EXISTS item_condition text,
  ADD COLUMN IF NOT EXISTS all_items_returned boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_items_description text;
