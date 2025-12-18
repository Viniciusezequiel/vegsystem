-- Fix RLS: avoid querying auth.users inside policies (can cause permission errors)
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;

CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  lower(requester_email) = lower(auth.email())
);