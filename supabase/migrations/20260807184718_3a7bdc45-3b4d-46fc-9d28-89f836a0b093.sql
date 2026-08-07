ALTER TABLE public.ps_candidates
  ADD COLUMN IF NOT EXISTS process_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS barcode text;