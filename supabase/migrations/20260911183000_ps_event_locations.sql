-- Structured locations for Processo Seletivo: Local -> Predio -> Andar -> Sala.
CREATE TABLE IF NOT EXISTS public.ps_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ps_locations_name_address_unique
ON public.ps_locations (lower(btrim(name)), lower(btrim(address)));

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
  CONSTRAINT ps_location_rooms_capacity_check CHECK (capacity IS NULL OR capacity >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ps_location_rooms_unique
ON public.ps_location_rooms (location_id, lower(btrim(building)), lower(btrim(floor)), lower(btrim(room)));

CREATE TABLE IF NOT EXISTS public.ps_event_locations (
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.ps_locations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, location_id)
);

ALTER TABLE public.ps_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_location_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users manage ps locations" ON public.ps_locations;
CREATE POLICY "Internal users manage ps locations" ON public.ps_locations FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal users manage ps location rooms" ON public.ps_location_rooms;
CREATE POLICY "Internal users manage ps location rooms" ON public.ps_location_rooms FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
DROP POLICY IF EXISTS "Internal users manage ps event locations" ON public.ps_event_locations;
CREATE POLICY "Internal users manage ps event locations" ON public.ps_event_locations FOR ALL TO authenticated
USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

REVOKE ALL ON public.ps_locations, public.ps_location_rooms, public.ps_event_locations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_locations, public.ps_location_rooms, public.ps_event_locations TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_create_and_link_event_location(p_event_id uuid,p_name text,p_address text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_location_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF nullif(btrim(p_name),'') IS NULL OR nullif(btrim(p_address),'') IS NULL THEN RAISE EXCEPTION 'Nome e endereço são obrigatórios'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id=p_event_id) THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  SELECT id INTO v_location_id FROM public.ps_locations WHERE lower(btrim(name))=lower(btrim(p_name)) AND lower(btrim(address))=lower(btrim(p_address)) LIMIT 1;
  IF v_location_id IS NULL THEN INSERT INTO public.ps_locations(name,address) VALUES(btrim(p_name),btrim(p_address)) RETURNING id INTO v_location_id; END IF;
  INSERT INTO public.ps_event_locations(event_id,location_id) VALUES(p_event_id,v_location_id) ON CONFLICT DO NOTHING;
  RETURN v_location_id;
END;$$;
REVOKE ALL ON FUNCTION public.ps_admin_create_and_link_event_location(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_create_and_link_event_location(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ps_admin_import_event_locations(p_event_id uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_row jsonb; v_location_id uuid; v_name text; v_address text; v_building text; v_floor text; v_room text; v_capacity integer; v_rooms integer:=0; v_locations integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id=p_event_id) THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  IF jsonb_typeof(p_rows)<>'array' THEN RAISE EXCEPTION 'Planilha inválida'; END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_name:=btrim(coalesce(v_row->>'local','')); v_address:=btrim(coalesce(v_row->>'address','')); v_building:=btrim(coalesce(v_row->>'building','')); v_floor:=btrim(coalesce(v_row->>'floor','')); v_room:=btrim(coalesce(v_row->>'room',''));
    v_capacity:=CASE WHEN nullif(btrim(coalesce(v_row->>'capacity','')),'') IS NULL THEN NULL WHEN (v_row->>'capacity')~'^\d+$' THEN (v_row->>'capacity')::integer ELSE NULL END;
    IF v_name='' OR v_address='' OR v_building='' OR v_floor='' OR v_room='' THEN RAISE EXCEPTION 'Local, Endereço, Prédio, Andar e Sala são obrigatórios'; END IF;
    SELECT id INTO v_location_id FROM public.ps_locations WHERE lower(btrim(name))=lower(v_name) AND lower(btrim(address))=lower(v_address) LIMIT 1;
    IF v_location_id IS NULL THEN INSERT INTO public.ps_locations(name,address) VALUES(v_name,v_address) RETURNING id INTO v_location_id; v_locations:=v_locations+1; END IF;
    INSERT INTO public.ps_event_locations(event_id,location_id) VALUES(p_event_id,v_location_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.ps_location_rooms(location_id,building,floor,room,capacity,active,updated_at) VALUES(v_location_id,v_building,v_floor,v_room,v_capacity,true,now())
    ON CONFLICT (location_id, lower(btrim(building)), lower(btrim(floor)), lower(btrim(room))) DO UPDATE SET capacity=EXCLUDED.capacity,active=true,updated_at=now();
    v_rooms:=v_rooms+1;
  END LOOP;
  RETURN jsonb_build_object('locations_created',v_locations,'rooms_upserted',v_rooms);
END;$$;
REVOKE ALL ON FUNCTION public.ps_admin_import_event_locations(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_admin_import_event_locations(uuid,jsonb) TO authenticated;
