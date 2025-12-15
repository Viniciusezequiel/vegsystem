-- Add room-specific checklist items column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS checklist_items jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.rooms.checklist_items IS 'JSON array of room-specific checklist items, each with id, label fields';