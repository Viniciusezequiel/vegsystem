-- Processo Seletivo 2: fundação isolada de estrutura física e alocação.
-- Esta migration cria somente tabelas novas ps_v2_* e não altera o módulo legado.

CREATE TABLE IF NOT EXISTS public.ps_v2_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address_line text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'legacy')),
  legacy_campus_id uuid REFERENCES public.ps_campuses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ps_v2_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.ps_v2_locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS public.ps_v2_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.ps_v2_buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS public.ps_v2_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id uuid NOT NULL REFERENCES public.ps_v2_floors(id) ON DELETE CASCADE,
  name text NOT NULL,
  area_type text NOT NULL DEFAULT 'other' CHECK (area_type IN ('corridor', 'sanitary', 'entrance', 'coordination', 'support', 'other')),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (floor_id, name)
);

CREATE TABLE IF NOT EXISTS public.ps_v2_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id uuid NOT NULL REFERENCES public.ps_v2_floors(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.ps_v2_areas(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  environment_type text NOT NULL DEFAULT 'classroom' CHECK (environment_type IN ('classroom', 'bathroom', 'coordination', 'support', 'entrance', 'other')),
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (floor_id, name)
);

-- Um evento pode utilizar um ou mais locais já cadastrados.
CREATE TABLE IF NOT EXISTS public.ps_v2_event_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.ps_v2_locations(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, location_id)
);

-- Necessidades de equipe podem existir em qualquer nível da estrutura.
-- event_id NULL = regra padrão reutilizável do local.
-- event_id preenchido = necessidade específica daquele evento.
CREATE TABLE IF NOT EXISTS public.ps_v2_staff_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.ps_events(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('location', 'building', 'floor', 'area', 'environment')),
  location_id uuid REFERENCES public.ps_v2_locations(id) ON DELETE CASCADE,
  building_id uuid REFERENCES public.ps_v2_buildings(id) ON DELETE CASCADE,
  floor_id uuid REFERENCES public.ps_v2_floors(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.ps_v2_areas(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.ps_v2_environments(id) ON DELETE CASCADE,
  role_id uuid REFERENCES public.ps_roles(id) ON DELETE SET NULL,
  role_name_snapshot text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_time time,
  end_time time,
  priority integer NOT NULL DEFAULT 100,
  required boolean NOT NULL DEFAULT true,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(location_id, building_id, floor_id, area_id, environment_id) = 1),
  CHECK (
    (scope_type = 'location' AND location_id IS NOT NULL) OR
    (scope_type = 'building' AND building_id IS NOT NULL) OR
    (scope_type = 'floor' AND floor_id IS NOT NULL) OR
    (scope_type = 'area' AND area_id IS NOT NULL) OR
    (scope_type = 'environment' AND environment_id IS NOT NULL)
  )
);

-- Matriz de elegibilidade por função. Permite bloquear combinações impróprias
-- e também preferir perfis mais adequados (ex.: higienização -> fiscal sanitário).
CREATE TABLE IF NOT EXISTS public.ps_v2_role_eligibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_role_id uuid NOT NULL REFERENCES public.ps_roles(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny', 'prefer')),
  collaborator_field text NOT NULL CHECK (collaborator_field IN ('role', 'position', 'sector', 'unit', 'preferred_role', 'any')),
  match_operator text NOT NULL DEFAULT 'contains' CHECK (match_operator IN ('equals', 'contains', 'starts_with', 'any')),
  match_value text,
  min_participations integer CHECK (min_participations IS NULL OR min_participations >= 0),
  min_rating numeric CHECK (min_rating IS NULL OR min_rating >= 0),
  weight integer NOT NULL DEFAULT 0,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cada execução automática nasce como rascunho e nunca publica diretamente.
CREATE TABLE IF NOT EXISTS public.ps_v2_allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'cancelled')),
  strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ps_v2_allocation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ps_v2_allocation_runs(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.ps_v2_staff_requirements(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  allocation_source text NOT NULL DEFAULT 'automatic' CHECK (allocation_source IN ('automatic', 'manual', 'import')),
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected')),
  locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ps_v2_buildings_location_idx ON public.ps_v2_buildings(location_id);
CREATE INDEX IF NOT EXISTS ps_v2_floors_building_idx ON public.ps_v2_floors(building_id);
CREATE INDEX IF NOT EXISTS ps_v2_areas_floor_idx ON public.ps_v2_areas(floor_id);
CREATE INDEX IF NOT EXISTS ps_v2_environments_floor_idx ON public.ps_v2_environments(floor_id);
CREATE INDEX IF NOT EXISTS ps_v2_environments_area_idx ON public.ps_v2_environments(area_id);
CREATE INDEX IF NOT EXISTS ps_v2_event_locations_event_idx ON public.ps_v2_event_locations(event_id);
CREATE INDEX IF NOT EXISTS ps_v2_requirements_event_idx ON public.ps_v2_staff_requirements(event_id);
CREATE INDEX IF NOT EXISTS ps_v2_eligibility_role_idx ON public.ps_v2_role_eligibility(event_role_id);
CREATE INDEX IF NOT EXISTS ps_v2_allocation_runs_event_idx ON public.ps_v2_allocation_runs(event_id);
CREATE INDEX IF NOT EXISTS ps_v2_allocation_items_run_idx ON public.ps_v2_allocation_items(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_floors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_environments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_event_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_staff_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_role_eligibility TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_allocation_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_v2_allocation_items TO authenticated;

GRANT ALL ON public.ps_v2_locations TO service_role;
GRANT ALL ON public.ps_v2_buildings TO service_role;
GRANT ALL ON public.ps_v2_floors TO service_role;
GRANT ALL ON public.ps_v2_areas TO service_role;
GRANT ALL ON public.ps_v2_environments TO service_role;
GRANT ALL ON public.ps_v2_event_locations TO service_role;
GRANT ALL ON public.ps_v2_staff_requirements TO service_role;
GRANT ALL ON public.ps_v2_role_eligibility TO service_role;
GRANT ALL ON public.ps_v2_allocation_runs TO service_role;
GRANT ALL ON public.ps_v2_allocation_items TO service_role;

ALTER TABLE public.ps_v2_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_event_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_staff_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_role_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_allocation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_v2_allocation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_v2_locations internal manage" ON public.ps_v2_locations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_buildings internal manage" ON public.ps_v2_buildings FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_floors internal manage" ON public.ps_v2_floors FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_areas internal manage" ON public.ps_v2_areas FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_environments internal manage" ON public.ps_v2_environments FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_event_locations internal manage" ON public.ps_v2_event_locations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_requirements internal manage" ON public.ps_v2_staff_requirements FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_eligibility internal manage" ON public.ps_v2_role_eligibility FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_allocation_runs internal manage" ON public.ps_v2_allocation_runs FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_v2_allocation_items internal manage" ON public.ps_v2_allocation_items FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TRIGGER ps_v2_locations_updated BEFORE UPDATE ON public.ps_v2_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_buildings_updated BEFORE UPDATE ON public.ps_v2_buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_floors_updated BEFORE UPDATE ON public.ps_v2_floors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_areas_updated BEFORE UPDATE ON public.ps_v2_areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_environments_updated BEFORE UPDATE ON public.ps_v2_environments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_event_locations_updated BEFORE UPDATE ON public.ps_v2_event_locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_requirements_updated BEFORE UPDATE ON public.ps_v2_staff_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_eligibility_updated BEFORE UPDATE ON public.ps_v2_role_eligibility FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_allocation_runs_updated BEFORE UPDATE ON public.ps_v2_allocation_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_v2_allocation_items_updated BEFORE UPDATE ON public.ps_v2_allocation_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
