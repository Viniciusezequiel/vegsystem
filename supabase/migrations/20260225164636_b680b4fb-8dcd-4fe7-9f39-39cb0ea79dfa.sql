-- Fix overly permissive INSERT RLS policies flagged by scanner
DROP POLICY IF EXISTS "Authenticated users can insert checklist answers" ON public.checklist_answers;
CREATE POLICY "Authenticated users can insert checklist answers"
ON public.checklist_answers
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can create external equipment requests" ON public.external_equipment_requests;
CREATE POLICY "Anyone can create external equipment requests"
ON public.external_equipment_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert logs" ON public.reservation_logs;
CREATE POLICY "System can insert logs"
ON public.reservation_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'analista'::public.app_role)
  OR has_role(auth.uid(), 'assistente'::public.app_role)
  OR has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- Move pg_trgm extension out of public schema (scanner warning)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;