-- Fix: Restrict external_equipment_requests SELECT access to admins and collaborators only
-- This prevents public exposure of PII (names, emails, phone numbers)

DROP POLICY IF EXISTS "Anyone can view requests by email" ON public.external_equipment_requests;

CREATE POLICY "Admins and collaborators can view external requests" 
ON public.external_equipment_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));