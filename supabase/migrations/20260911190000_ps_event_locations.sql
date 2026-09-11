CREATE TABLE IF NOT EXISTS public.ps_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_locations_name_address_unique UNIQUE (name, address)
);

CREATE TABLE IF NOT EXISTS public.ps_location_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.ps_locations(id) ON DELETE CASCADE,
  building text NOT NULL,
  floor text NOT NULL,
  room text NOT NULL,
  capacity integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_location_rooms_unique UNIQUE (location_id, building, floor, room),
  CONSTRAINT ps_location_rooms_capacity_check CHECK (capacity IS NULL OR capacity >= 0)
);

CREATE TABLE IF NOT EXISTS public.ps_event_locations (
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.ps_locations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, location_id)
);

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.ps_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_room_id uuid REFERENCES public.ps_location_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_address text;

CREATE INDEX IF NOT EXISTS ps_location_rooms_location_idx ON public.ps_location_rooms(location_id);
CREATE INDEX IF NOT EXISTS ps_location_rooms_path_idx ON public.ps_location_rooms(location_id, building, floor, room);
CREATE INDEX IF NOT EXISTS ps_event_locations_event_idx ON public.ps_event_locations(event_id);
CREATE INDEX IF NOT EXISTS ps_event_collaborators_location_idx ON public.ps_event_collaborators(location_id, location_room_id);

ALTER TABLE public.ps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_location_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_locations_internal_all ON public.ps_locations;
CREATE POLICY ps_locations_internal_all ON public.ps_locations
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS ps_location_rooms_internal_all ON public.ps_location_rooms;
CREATE POLICY ps_location_rooms_internal_all ON public.ps_location_rooms
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS ps_event_locations_internal_all ON public.ps_event_locations;
CREATE POLICY ps_event_locations_internal_all ON public.ps_event_locations
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

REVOKE ALL ON public.ps_locations, public.ps_location_rooms, public.ps_event_locations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_locations, public.ps_location_rooms, public.ps_event_locations TO authenticated;

COMMENT ON TABLE public.ps_locations IS 'Locais/campi reutilizáveis do Processo Seletivo.';
COMMENT ON TABLE public.ps_location_rooms IS 'Estrutura física: prédio, andar, sala e capacidade de cada local.';
COMMENT ON TABLE public.ps_event_locations IS 'Locais habilitados para um evento do Processo Seletivo.';
