-- Fix 1: Restrict app_settings SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read settings" ON public.app_settings
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 2: Restrict shift_handovers SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handovers" ON public.shift_handovers;
CREATE POLICY "Authenticated users can view shift handovers" ON public.shift_handovers
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 3: Restrict shift_handover_tasks SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 4: Restrict shift_handover_incidents SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents
FOR SELECT USING (auth.uid() IS NOT NULL);