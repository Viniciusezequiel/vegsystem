CREATE TABLE public.semester_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_item_options TO authenticated;
GRANT ALL ON public.semester_item_options TO service_role;

ALTER TABLE public.semester_item_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view options"
  ON public.semester_item_options FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage options - insert"
  ON public.semester_item_options FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage options - update"
  ON public.semester_item_options FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage options - delete"
  ON public.semester_item_options FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_semester_item_options_updated_at
  BEFORE UPDATE ON public.semester_item_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_semester_item_options_category ON public.semester_item_options(category, sort_order);