-- Follow-up for projects where the remarcação migration was already applied.
CREATE INDEX IF NOT EXISTS ps_training_reselection_cancelled_session_idx
  ON public.ps_training_reselection_requests(cancelled_session_id);
CREATE INDEX IF NOT EXISTS ps_training_reselection_group_idx
  ON public.ps_training_reselection_requests(training_group_id);
CREATE INDEX IF NOT EXISTS ps_training_reselection_replacement_session_idx
  ON public.ps_training_reselection_requests(replacement_session_id)
  WHERE replacement_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ps_training_reselection_created_by_idx
  ON public.ps_training_reselection_requests(created_by)
  WHERE created_by IS NOT NULL;

DROP POLICY IF EXISTS "ps_training_reselection internal read" ON public.ps_training_reselection_requests;
CREATE POLICY "ps_training_reselection internal read"
  ON public.ps_training_reselection_requests
  FOR SELECT TO authenticated
  USING ((SELECT public.is_internal_user((SELECT auth.uid()))));
