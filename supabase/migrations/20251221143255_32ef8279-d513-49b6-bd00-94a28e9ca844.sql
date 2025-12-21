-- Enable pg_trgm extension for trigram search (faster ILIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes to improve lost_items query performance
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON public.lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_campus ON public.lost_items(campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_received_date ON public.lost_items(received_date);
CREATE INDEX IF NOT EXISTS idx_lost_items_created_at ON public.lost_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_code ON public.lost_items(code);
CREATE INDEX IF NOT EXISTS idx_lost_items_owner_name ON public.lost_items(owner_name);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_lost_items_status_campus ON public.lost_items(status, campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_status_created_at ON public.lost_items(status, created_at DESC);

-- Trigram index for faster ILIKE searches
CREATE INDEX IF NOT EXISTS idx_lost_items_code_trgm ON public.lost_items USING gin(code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_description_trgm ON public.lost_items USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_found_location_trgm ON public.lost_items USING gin(found_location gin_trgm_ops);

-- Add index to profiles table for email lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Add index to external_users for email lookup
CREATE INDEX IF NOT EXISTS idx_external_users_email ON public.external_users(email);