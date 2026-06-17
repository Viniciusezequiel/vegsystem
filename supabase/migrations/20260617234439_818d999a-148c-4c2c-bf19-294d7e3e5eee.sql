ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS import_tag text;
CREATE INDEX IF NOT EXISTS idx_reservations_import_tag ON public.reservations(import_tag) WHERE import_tag IS NOT NULL;