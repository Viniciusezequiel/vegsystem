
ALTER TABLE public.reservation_rooms
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS equipment jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.external_users
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.external_users SET approval_status = 'approved' WHERE approval_status = 'pending' AND created_at < now() - interval '1 minute';

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS original_reservation_id uuid;

GRANT SELECT ON public.reservation_rooms TO anon, authenticated;
GRANT ALL ON public.reservation_rooms TO service_role;

DROP POLICY IF EXISTS "Only admins can change approval_status" ON public.external_users;
CREATE POLICY "Only admins can change approval_status"
  ON public.external_users
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role));

CREATE INDEX IF NOT EXISTS idx_external_users_approval_status ON public.external_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_original ON public.reservations(original_reservation_id);
