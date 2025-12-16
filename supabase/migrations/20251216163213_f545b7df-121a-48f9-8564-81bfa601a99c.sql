-- Fix: Update RLS policy to allow supervisor to view activity logs
DROP POLICY IF EXISTS "Admins and analistas can view activity logs" ON public.activity_logs;

CREATE POLICY "Internal users can view activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role)
  );