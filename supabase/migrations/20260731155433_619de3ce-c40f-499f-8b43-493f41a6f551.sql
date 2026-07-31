CREATE TABLE public.uber_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  requester_name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  trip_date date NOT NULL,
  trip_time text NOT NULL,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'registrada',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.uber_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_requests TO authenticated;
GRANT ALL ON public.uber_requests TO service_role;

ALTER TABLE public.uber_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create uber requests"
ON public.uber_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view uber requests"
ON public.uber_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update uber requests"
ON public.uber_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete uber requests"
ON public.uber_requests FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_uber_requests_created_at ON public.uber_requests (created_at DESC);

CREATE TRIGGER update_uber_requests_updated_at
BEFORE UPDATE ON public.uber_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();