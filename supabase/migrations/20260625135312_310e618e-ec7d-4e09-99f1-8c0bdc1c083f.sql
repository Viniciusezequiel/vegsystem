
-- ENUMS
CREATE TYPE public.semester_competency_status AS ENUM ('draft','released','blocked','finished');
CREATE TYPE public.semester_item_status AS ENUM ('pending_analysis','pending_ticket','ticket_opened','in_maintenance','waiting_parts','completed','written_off','cancelled');
CREATE TYPE public.semester_maintenance_type AS ENUM ('internal','external');

-- ============ COMPETENCIES ============
CREATE TABLE public.semester_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.semester_competency_status NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_competencies TO authenticated;
GRANT ALL ON public.semester_competencies TO service_role;
ALTER TABLE public.semester_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view competencies" ON public.semester_competencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage competencies" ON public.semester_competencies
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_competencies_updated
  BEFORE UPDATE ON public.semester_competencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHECKLISTS ============
CREATE TABLE public.semester_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES public.semester_competencies(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.reservation_rooms(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  room_code text,
  campus text,
  floor text,
  responsible_id uuid,
  responsible_name text NOT NULL,
  checklist_date date NOT NULL DEFAULT CURRENT_DATE,
  general_observation text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_checklists_competency ON public.semester_checklists(competency_id);
CREATE INDEX idx_semester_checklists_room ON public.semester_checklists(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_checklists TO authenticated;
GRANT ALL ON public.semester_checklists TO service_role;
ALTER TABLE public.semester_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view checklists" ON public.semester_checklists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert checklists when released" ON public.semester_checklists
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_competencies c
      WHERE c.id = competency_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update checklists" ON public.semester_checklists
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete checklists" ON public.semester_checklists
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_checklists_updated
  BEFORE UPDATE ON public.semester_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHECKLIST ITEMS ============
CREATE TABLE public.semester_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.semester_checklists(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  observation text,
  maintenance_type public.semester_maintenance_type,
  needs_ticket boolean NOT NULL DEFAULT false,
  needs_label boolean NOT NULL DEFAULT false,
  photo_url text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  ticket_number text,
  ticket_opened_at timestamptz,
  ticket_responsible text,
  maintenance_done_at timestamptz,
  closure_observation text,
  closure_responsible text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_items_checklist ON public.semester_checklist_items(checklist_id);
CREATE INDEX idx_semester_items_status ON public.semester_checklist_items(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_checklist_items TO authenticated;
GRANT ALL ON public.semester_checklist_items TO service_role;
ALTER TABLE public.semester_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view items" ON public.semester_checklist_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert items when released" ON public.semester_checklist_items
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = checklist_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update items" ON public.semester_checklist_items
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete items" ON public.semester_checklist_items
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_items_updated
  BEFORE UPDATE ON public.semester_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FURNITURE DETAILS ============
CREATE TABLE public.semester_furniture_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.semester_checklist_items(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  problem_type text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  maintenance_type public.semester_maintenance_type,
  observation text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_furniture_item ON public.semester_furniture_details(checklist_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_furniture_details TO authenticated;
GRANT ALL ON public.semester_furniture_details TO service_role;
ALTER TABLE public.semester_furniture_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view furniture" ON public.semester_furniture_details
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert furniture when released" ON public.semester_furniture_details
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklist_items i
      JOIN public.semester_checklists ch ON ch.id = i.checklist_id
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE i.id = checklist_item_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update furniture" ON public.semester_furniture_details
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete furniture" ON public.semester_furniture_details
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_furniture_updated
  BEFORE UPDATE ON public.semester_furniture_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LABELS ============
CREATE TABLE public.semester_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES public.semester_checklist_items(id) ON DELETE CASCADE,
  furniture_detail_id uuid REFERENCES public.semester_furniture_details(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.semester_competencies(id) ON DELETE CASCADE,
  label_code text NOT NULL UNIQUE,
  sequence_number int NOT NULL,
  sequence_total int NOT NULL,
  generated_by uuid,
  generated_by_name text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_labels_competency ON public.semester_labels(competency_id);
CREATE INDEX idx_semester_labels_item ON public.semester_labels(checklist_item_id);
CREATE INDEX idx_semester_labels_furniture ON public.semester_labels(furniture_detail_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_labels TO authenticated;
GRANT ALL ON public.semester_labels TO service_role;
ALTER TABLE public.semester_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view labels" ON public.semester_labels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert labels" ON public.semester_labels
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin delete labels" ON public.semester_labels
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
