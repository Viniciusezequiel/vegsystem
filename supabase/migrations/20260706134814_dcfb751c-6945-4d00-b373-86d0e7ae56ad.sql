
CREATE TABLE public.semester_projectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.semester_checklists(id) ON DELETE CASCADE,
  patrimony text,
  model text,
  lamp_hours integer,
  actions text[] NOT NULL DEFAULT '{}'::text[],
  others_text text,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_projectors TO authenticated;
GRANT ALL ON public.semester_projectors TO service_role;

ALTER TABLE public.semester_projectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view projectors" ON public.semester_projectors
  FOR SELECT USING (true);

CREATE POLICY "auth insert projectors when released" ON public.semester_projectors
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = semester_projectors.checklist_id
        AND c.status = 'released'::semester_competency_status
    )
  );

CREATE POLICY "auth update projectors when released" ON public.semester_projectors
  FOR UPDATE USING (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = semester_projectors.checklist_id
        AND c.status = 'released'::semester_competency_status
    )
  );

CREATE POLICY "admin delete projectors" ON public.semester_projectors
  FOR DELETE USING (is_admin(auth.uid()));

CREATE TRIGGER trg_semester_projectors_updated
BEFORE UPDATE ON public.semester_projectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_semester_projectors_checklist ON public.semester_projectors(checklist_id);
