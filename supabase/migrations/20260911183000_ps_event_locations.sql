-- Structured locations for Processo Seletivo.
-- Hierarchy: Local -> Building -> Floor -> Room. No block level is used.

CREATE TABLE IF NOT EXISTS public.ps_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  address text,
  name_key text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_locations_name_key_unique UNIQUE (name_key)
);

CREATE TABLE IF NOT EXISTS public.ps_location_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.ps_locations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (btrim(name) <> ''),
  name_key text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_location_buildings_unique UNIQUE (location_id, name_key)
);

CREATE TABLE IF NOT EXISTS public.ps_location_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.ps_location_buildings(id) ON DELETE CASCADE,
  floor text NOT NULL CHECK (btrim(floor) <> ''),
  room text NOT NULL CHECK (btrim(room) <> ''),
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  floor_key text GENERATED ALWAYS AS (lower(btrim(floor))) STORED,
  room_key text GENERATED ALWAYS AS (lower(btrim(room))) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_location_rooms_unique UNIQUE (building_id, floor_key, room_key)
);

CREATE TABLE IF NOT EXISTS public.ps_event_locations (
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.ps_locations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, location_id)
);

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.ps_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building_id uuid REFERENCES public.ps_location_buildings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.ps_location_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_address text;

CREATE INDEX IF NOT EXISTS ps_location_buildings_location_idx ON public.ps_location_buildings(location_id);
CREATE INDEX IF NOT EXISTS ps_location_rooms_building_idx ON public.ps_location_rooms(building_id);
CREATE INDEX IF NOT EXISTS ps_event_locations_location_idx ON public.ps_event_locations(location_id);
CREATE INDEX IF NOT EXISTS ps_event_collaborators_location_idx ON public.ps_event_collaborators(event_id, location_id, building_id, room_id);

ALTER TABLE public.ps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_location_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_location_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_locations internal manage" ON public.ps_locations;
CREATE POLICY "ps_locations internal manage" ON public.ps_locations
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "ps_location_buildings internal manage" ON public.ps_location_buildings;
CREATE POLICY "ps_location_buildings internal manage" ON public.ps_location_buildings
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "ps_location_rooms internal manage" ON public.ps_location_rooms;
CREATE POLICY "ps_location_rooms internal manage" ON public.ps_location_rooms
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "ps_event_locations internal manage" ON public.ps_event_locations;
CREATE POLICY "ps_event_locations internal manage" ON public.ps_event_locations
FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid()))
WITH CHECK (public.is_internal_user(auth.uid()));

DROP TRIGGER IF EXISTS ps_locations_updated ON public.ps_locations;
CREATE TRIGGER ps_locations_updated BEFORE UPDATE ON public.ps_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ps_location_buildings_updated ON public.ps_location_buildings;
CREATE TRIGGER ps_location_buildings_updated BEFORE UPDATE ON public.ps_location_buildings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS ps_location_rooms_updated ON public.ps_location_rooms;
CREATE TRIGGER ps_location_rooms_updated BEFORE UPDATE ON public.ps_location_rooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.ps_refresh_event_location_label(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_label text;
BEGIN
  SELECT string_agg(l.name, ', ' ORDER BY l.name)
  INTO v_label
  FROM public.ps_event_locations el
  JOIN public.ps_locations l ON l.id = el.location_id
  WHERE el.event_id = p_event_id;

  UPDATE public.ps_events
  SET location = nullif(v_label, '')
  WHERE id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_refresh_event_location_label(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_refresh_event_location_label(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ps_admin_attach_event_location(
  p_event_id uuid,
  p_location_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ps_locations WHERE id = p_location_id AND active) THEN
    RAISE EXCEPTION 'Local não encontrado';
  END IF;

  INSERT INTO public.ps_event_locations(event_id, location_id)
  VALUES (p_event_id, p_location_id)
  ON CONFLICT DO NOTHING;

  PERFORM public.ps_refresh_event_location_label(p_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_attach_event_location(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_attach_event_location(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ps_admin_create_and_attach_location(
  p_event_id uuid,
  p_name text,
  p_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_address text := nullif(regexp_replace(btrim(coalesce(p_address, '')), '\s+', ' ', 'g'), '');
  v_location_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'Informe o nome do local'; END IF;

  SELECT id INTO v_location_id
  FROM public.ps_locations
  WHERE name_key = lower(v_name)
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.ps_locations(name, address)
    VALUES (v_name, v_address)
    RETURNING id INTO v_location_id;
  ELSE
    UPDATE public.ps_locations
    SET address = coalesce(v_address, address), active = true
    WHERE id = v_location_id;
  END IF;

  PERFORM public.ps_admin_attach_event_location(p_event_id, v_location_id);
  RETURN v_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_create_and_attach_location(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_create_and_attach_location(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ps_admin_import_event_locations(
  p_event_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row jsonb;
  v_local text;
  v_address text;
  v_building text;
  v_floor text;
  v_room text;
  v_capacity integer;
  v_location_id uuid;
  v_building_id uuid;
  v_room_id uuid;
  v_rows integer := 0;
  v_locations uuid[] := ARRAY[]::uuid[];
  v_buildings uuid[] := ARRAY[]::uuid[];
  v_rooms uuid[] := ARRAY[]::uuid[];
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Formato de importação inválido';
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_local := regexp_replace(btrim(coalesce(v_row->>'local', '')), '\s+', ' ', 'g');
    v_address := nullif(regexp_replace(btrim(coalesce(v_row->>'address', '')), '\s+', ' ', 'g'), '');
    v_building := regexp_replace(btrim(coalesce(v_row->>'building', '')), '\s+', ' ', 'g');
    v_floor := regexp_replace(btrim(coalesce(v_row->>'floor', '')), '\s+', ' ', 'g');
    v_room := regexp_replace(btrim(coalesce(v_row->>'room', '')), '\s+', ' ', 'g');
    v_capacity := CASE
      WHEN coalesce(v_row->>'capacity', '') ~ '^\d+$' THEN (v_row->>'capacity')::integer
      ELSE NULL
    END;

    IF v_local = '' OR v_building = '' OR v_floor = '' OR v_room = '' THEN
      RAISE EXCEPTION 'Local, Prédio, Andar e Sala são obrigatórios em todas as linhas';
    END IF;

    SELECT id INTO v_location_id FROM public.ps_locations WHERE name_key = lower(v_local) LIMIT 1;
    IF v_location_id IS NULL THEN
      INSERT INTO public.ps_locations(name, address) VALUES (v_local, v_address)
      RETURNING id INTO v_location_id;
    ELSE
      UPDATE public.ps_locations
      SET address = coalesce(v_address, address), active = true
      WHERE id = v_location_id;
    END IF;

    INSERT INTO public.ps_event_locations(event_id, location_id)
    VALUES (p_event_id, v_location_id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_building_id
    FROM public.ps_location_buildings
    WHERE location_id = v_location_id AND name_key = lower(v_building)
    LIMIT 1;
    IF v_building_id IS NULL THEN
      INSERT INTO public.ps_location_buildings(location_id, name)
      VALUES (v_location_id, v_building)
      RETURNING id INTO v_building_id;
    ELSE
      UPDATE public.ps_location_buildings SET active = true WHERE id = v_building_id;
    END IF;

    SELECT id INTO v_room_id
    FROM public.ps_location_rooms
    WHERE building_id = v_building_id
      AND floor_key = lower(v_floor)
      AND room_key = lower(v_room)
    LIMIT 1;
    IF v_room_id IS NULL THEN
      INSERT INTO public.ps_location_rooms(building_id, floor, room, capacity)
      VALUES (v_building_id, v_floor, v_room, v_capacity)
      RETURNING id INTO v_room_id;
    ELSE
      UPDATE public.ps_location_rooms
      SET capacity = coalesce(v_capacity, capacity), active = true
      WHERE id = v_room_id;
    END IF;

    v_rows := v_rows + 1;
    IF NOT v_location_id = ANY(v_locations) THEN v_locations := array_append(v_locations, v_location_id); END IF;
    IF NOT v_building_id = ANY(v_buildings) THEN v_buildings := array_append(v_buildings, v_building_id); END IF;
    IF NOT v_room_id = ANY(v_rooms) THEN v_rooms := array_append(v_rooms, v_room_id); END IF;
  END LOOP;

  PERFORM public.ps_refresh_event_location_label(p_event_id);

  RETURN jsonb_build_object(
    'rows', v_rows,
    'locations', cardinality(v_locations),
    'buildings', cardinality(v_buildings),
    'rooms', cardinality(v_rooms)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_import_event_locations(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_import_event_locations(uuid, jsonb) TO authenticated, service_role;
