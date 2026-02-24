
-- Fix overly permissive INSERT policies on shift_handover_tasks and shift_handover_incidents
-- They should only allow inserts when the user owns the parent handover

DROP POLICY "Authenticated users can insert shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Authenticated users can insert shift handover tasks"
  ON public.shift_handover_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shift_handovers
      WHERE id = handover_id AND filled_by = auth.uid()
    )
  );

DROP POLICY "Authenticated users can insert shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Authenticated users can insert shift handover incidents"
  ON public.shift_handover_incidents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shift_handovers
      WHERE id = handover_id AND filled_by = auth.uid()
    )
  );
