-- Fix: Restrict reservation_logs SELECT access to admins and collaborators only
DROP POLICY IF EXISTS "Authenticated users can view logs" ON public.reservation_logs;

CREATE POLICY "Admins and collaborators can view logs" 
ON public.reservation_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));