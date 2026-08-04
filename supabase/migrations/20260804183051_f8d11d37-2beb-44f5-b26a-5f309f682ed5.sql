
-- ROLES
CREATE TABLE public.ps_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  pay_value numeric NOT NULL DEFAULT 0,
  combined_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_roles TO authenticated;
GRANT SELECT ON public.ps_roles TO anon;
GRANT ALL ON public.ps_roles TO service_role;
ALTER TABLE public.ps_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_roles internal manage" ON public.ps_roles FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_roles public read" ON public.ps_roles FOR SELECT TO anon USING (true);

-- COLLABORATORS
CREATE TABLE public.ps_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf text,
  matricula text,
  email text,
  phone text,
  role text,
  unit text,
  sector text,
  position text,
  journey text,
  pcd text NOT NULL DEFAULT 'NORMAL',
  city text,
  state text,
  pix text,
  total_events integer NOT NULL DEFAULT 0,
  average_rating numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_collaborators TO authenticated;
GRANT ALL ON public.ps_collaborators TO service_role;
ALTER TABLE public.ps_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_collaborators internal manage" ON public.ps_collaborators FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- EVENTS
CREATE TABLE public.ps_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  location text,
  description text,
  status text NOT NULL DEFAULT 'planejamento',
  coordinator_name text,
  notes text,
  hidden_from_evaluation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_events TO authenticated;
GRANT SELECT ON public.ps_events TO anon;
GRANT ALL ON public.ps_events TO service_role;
ALTER TABLE public.ps_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_events internal manage" ON public.ps_events FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_events public read" ON public.ps_events FOR SELECT TO anon USING (true);

-- EVENT COLLABORATORS
CREATE TABLE public.ps_event_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_name text NOT NULL,
  assigned_role text,
  sector text,
  campus text,
  evaluated boolean NOT NULL DEFAULT false,
  absent boolean NOT NULL DEFAULT false,
  signature_url text,
  signed_at timestamptz,
  signature_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_event_collaborators TO authenticated;
GRANT SELECT, UPDATE ON public.ps_event_collaborators TO anon;
GRANT ALL ON public.ps_event_collaborators TO service_role;
ALTER TABLE public.ps_event_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evcol internal manage" ON public.ps_event_collaborators FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evcol public read" ON public.ps_event_collaborators FOR SELECT TO anon USING (true);
CREATE POLICY "ps_evcol public update" ON public.ps_event_collaborators FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- CAMPUSES
CREATE TABLE public.ps_campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_campuses TO authenticated;
GRANT SELECT ON public.ps_campuses TO anon;
GRANT ALL ON public.ps_campuses TO service_role;
ALTER TABLE public.ps_campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_campuses internal manage" ON public.ps_campuses FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_campuses public read" ON public.ps_campuses FOR SELECT TO anon USING (true);

CREATE TABLE public.ps_campus_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid REFERENCES public.ps_campuses(id) ON DELETE CASCADE,
  campus_name text,
  name text NOT NULL,
  rooms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_campus_floors TO authenticated;
GRANT SELECT ON public.ps_campus_floors TO anon;
GRANT ALL ON public.ps_campus_floors TO service_role;
ALTER TABLE public.ps_campus_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_floors internal manage" ON public.ps_campus_floors FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_floors public read" ON public.ps_campus_floors FOR SELECT TO anon USING (true);

-- CANDIDATES
CREATE TABLE public.ps_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  registration_number text,
  cpf text,
  rg text,
  room text,
  campus text,
  exam_type text,
  seat_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_candidates TO authenticated;
GRANT ALL ON public.ps_candidates TO service_role;
ALTER TABLE public.ps_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_candidates internal manage" ON public.ps_candidates FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- EVALUATIONS
CREATE TABLE public.ps_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  assigned_role text NOT NULL DEFAULT '',
  collaborator_name text,
  sector text,
  punctuality integer NOT NULL DEFAULT 0,
  domain integer NOT NULL DEFAULT 0,
  room_control integer NOT NULL DEFAULT 0,
  attention_vigilance integer NOT NULL DEFAULT 0,
  professional_posture integer NOT NULL DEFAULT 0,
  communication integer NOT NULL DEFAULT 0,
  organization integer NOT NULL DEFAULT 0,
  incident_management integer NOT NULL DEFAULT 0,
  teamwork integer NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  classification text,
  observations text,
  evaluator_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluations TO authenticated;
GRANT SELECT, INSERT ON public.ps_evaluations TO anon;
GRANT ALL ON public.ps_evaluations TO service_role;
ALTER TABLE public.ps_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evaluations internal manage" ON public.ps_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evaluations public read" ON public.ps_evaluations FOR SELECT TO anon USING (true);
CREATE POLICY "ps_evaluations public insert" ON public.ps_evaluations FOR INSERT TO anon WITH CHECK (true);

-- GENERAL EVALUATIONS
CREATE TABLE public.ps_general_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  evaluator_name text NOT NULL,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  collaborator_name text NOT NULL,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_role text,
  collaborator_position text,
  punctuality integer NOT NULL DEFAULT 0,
  domain integer NOT NULL DEFAULT 0,
  room_control integer NOT NULL DEFAULT 0,
  attention_vigilance integer NOT NULL DEFAULT 0,
  professional_posture integer NOT NULL DEFAULT 0,
  communication integer NOT NULL DEFAULT 0,
  organization integer NOT NULL DEFAULT 0,
  incident_management integer NOT NULL DEFAULT 0,
  teamwork integer NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  classification text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_general_evaluations TO authenticated;
GRANT ALL ON public.ps_general_evaluations TO service_role;
ALTER TABLE public.ps_general_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_gen_eval internal manage" ON public.ps_general_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- SELF EVALUATIONS
CREATE TABLE public.ps_self_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.ps_events(id) ON DELETE CASCADE,
  respondent_name text,
  identified boolean NOT NULL DEFAULT false,
  role text,
  training_rating integer,
  training_comment text,
  organization_rating integer,
  organization_comment text,
  snack_rating integer,
  snack_comment text,
  partner_fiscal_rating integer,
  partner_fiscal_comment text,
  had_incident boolean NOT NULL DEFAULT false,
  incident_comment text,
  suggestions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_self_evaluations TO authenticated;
GRANT INSERT ON public.ps_self_evaluations TO anon;
GRANT ALL ON public.ps_self_evaluations TO service_role;
ALTER TABLE public.ps_self_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_self_eval internal manage" ON public.ps_self_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_self_eval public insert" ON public.ps_self_evaluations FOR INSERT TO anon WITH CHECK (true);

-- RETIFICATIONS
CREATE TABLE public.ps_evaluation_retifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL REFERENCES public.ps_evaluations(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_name text,
  requested_by text NOT NULL,
  criteria text[] NOT NULL DEFAULT '{}',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  coordinator_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluation_retifications TO authenticated;
GRANT INSERT ON public.ps_evaluation_retifications TO anon;
GRANT ALL ON public.ps_evaluation_retifications TO service_role;
ALTER TABLE public.ps_evaluation_retifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_retif internal manage" ON public.ps_evaluation_retifications FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_retif public insert" ON public.ps_evaluation_retifications FOR INSERT TO anon WITH CHECK (true);

-- FISCAL BANK
CREATE TABLE public.ps_fiscal_bank_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome_completo text NOT NULL,
  telefone_contato text NOT NULL,
  instituto text NOT NULL,
  setor text NOT NULL,
  dominio_ingles text,
  habilidades_ingles text[] NOT NULL DEFAULT '{}',
  leitura_portugues text,
  escrita_portugues text,
  letra_legivel text,
  agilidade_digitacao text,
  funcoes_com_conforto text[] NOT NULL DEFAULT '{}',
  datas_disponibilidade text[] NOT NULL DEFAULT '{}',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_fiscal_bank_applications TO authenticated;
GRANT INSERT ON public.ps_fiscal_bank_applications TO anon;
GRANT ALL ON public.ps_fiscal_bank_applications TO service_role;
ALTER TABLE public.ps_fiscal_bank_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_fb_app internal manage" ON public.ps_fiscal_bank_applications FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_fb_app public insert" ON public.ps_fiscal_bank_applications FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE public.ps_fiscal_bank_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datas text[] NOT NULL DEFAULT '{}',
  data_indisponivel_label text NOT NULL DEFAULT 'Não tenho disponibilidade',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_fiscal_bank_config TO authenticated;
GRANT SELECT ON public.ps_fiscal_bank_config TO anon;
GRANT ALL ON public.ps_fiscal_bank_config TO service_role;
ALTER TABLE public.ps_fiscal_bank_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_fb_cfg internal manage" ON public.ps_fiscal_bank_config FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_fb_cfg public read" ON public.ps_fiscal_bank_config FOR SELECT TO anon USING (true);

-- updated_at triggers
CREATE TRIGGER ps_roles_updated BEFORE UPDATE ON public.ps_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_collaborators_updated BEFORE UPDATE ON public.ps_collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_events_updated BEFORE UPDATE ON public.ps_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_evcol_updated BEFORE UPDATE ON public.ps_event_collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_evaluations_updated BEFORE UPDATE ON public.ps_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_gen_eval_updated BEFORE UPDATE ON public.ps_general_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_retif_updated BEFORE UPDATE ON public.ps_evaluation_retifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_fb_cfg_updated BEFORE UPDATE ON public.ps_fiscal_bank_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
