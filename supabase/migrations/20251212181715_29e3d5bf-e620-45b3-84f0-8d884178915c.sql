-- Add max_advance_days column to reservation_rooms table
-- This will allow configuring how many days in advance each room can be reserved
ALTER TABLE public.reservation_rooms 
ADD COLUMN IF NOT EXISTS max_advance_days INTEGER DEFAULT NULL;

-- A NULL value means no limit on advance booking
COMMENT ON COLUMN public.reservation_rooms.max_advance_days IS 'Maximum number of days in advance this room can be reserved. NULL means no limit.';