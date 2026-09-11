-- Compatibility for environments where the location tables were partially created before
-- the final structured-location migration. Keep existing IDs/data and add only the
-- normalization columns/indexes required by the final import routines.

ALTER TABLE public.ps_locations
  ADD COLUMN IF NOT EXISTS name_key text GENERATED ALWAYS AS (lower(btrim(name))) STORED;

ALTER TABLE public.ps_location_buildings
  ADD COLUMN IF NOT EXISTS name_key text GENERATED ALWAYS AS (lower(btrim(name))) STORED;

ALTER TABLE public.ps_location_rooms
  ADD COLUMN IF NOT EXISTS floor_key text GENERATED ALWAYS AS (lower(btrim(floor))) STORED,
  ADD COLUMN IF NOT EXISTS room_key text GENERATED ALWAYS AS (lower(btrim(room))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ps_locations_name_key_unique_idx
  ON public.ps_locations(name_key);

CREATE UNIQUE INDEX IF NOT EXISTS ps_location_buildings_location_name_key_unique_idx
  ON public.ps_location_buildings(location_id, name_key);

CREATE UNIQUE INDEX IF NOT EXISTS ps_location_rooms_building_floor_room_key_unique_idx
  ON public.ps_location_rooms(building_id, floor_key, room_key);
