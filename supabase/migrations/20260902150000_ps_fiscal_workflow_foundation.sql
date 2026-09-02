-- Processo Seletivo: fundacao do fluxo de avaliacao e presencia de fiscais.

CREATE TABLE IF NOT EXISTS public.ps_event_evaluator_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  evaluator_event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  campus text,
  building text,
  floor text,
  scope_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_event_evaluator_scopes_type_check
    CHECK (scope_type IN ('floor', 'building', 'campus', 'event')),
  CONSTRAINT ps_event_evaluator_scopes_location_check
    CHECK (
      (scope_type = 'floor' AND nullif(trim(floor), '') IS NOT NULL)
      OR (scope_type = 'building' AND nullif(trim(building), '') IS NOT NULL)
      OR (scope_type = 'campus' AND nullif(trim(campus), '') IS NOT NULL)
      OR scope_type = 'event'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_event_evaluator_scopes_unique_idx
  ON public.ps_event_evaluator_scopes (
    event_id,
    evaluator_event_collaborator_id,
    scope_type,
    coalesce(campus, ''),
    coalesce(building, ''),
    coalesce(floor, '')
  );
CREATE INDEX IF NOT EXISTS ps_event_evaluator_scopes_event_idx
  ON public.ps_event_evaluator_scopes (event_id, active);
CREATE INDEX IF NOT EXISTS ps_event_evaluator_scopes_evaluator_idx
  ON public.ps_event_evaluator_scopes (evaluator_event_collaborator_id, active);

CREATE TABLE IF NOT EXISTS public.ps_evaluation_scope_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  evaluator_event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluation_scope_overrides_unique_idx
  ON public.ps_evaluation_scope_overrides (event_id, evaluator_event_collaborator_id, event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_evaluation_scope_overrides_event_idx
  ON public.ps_evaluation_scope_overrides (event_id);
CREATE INDEX IF NOT EXISTS ps_evaluation_scope_overrides_evaluator_idx
  ON public.ps_evaluation_scope_overrides (evaluator_event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_evaluation_scope_overrides_collaborator_idx
  ON public.ps_evaluation_scope_overrides (event_collaborator_id);

ALTER TABLE public.ps_evaluations
  ADD COLUMN IF NOT EXISTS evaluation_level text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS evaluator_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evaluator_role text,
  ADD COLUMN IF NOT EXISTS evaluator_campus text,
  ADD COLUMN IF NOT EXISTS evaluator_building text,
  ADD COLUMN IF NOT EXISTS evaluator_floor text,
  ADD COLUMN IF NOT EXISTS role_changed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_role text,
  ADD COLUMN IF NOT EXISTS reported_role text,
  ADD COLUMN IF NOT EXISTS role_change_justification text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ps_evaluations'::regclass
      AND conname = 'ps_evaluations_level_check'
  ) THEN
    ALTER TABLE public.ps_evaluations
      ADD CONSTRAINT ps_evaluations_level_check
      CHECK (evaluation_level IN ('legacy', 'subcoordinator', 'coordination'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ps_evaluations'::regclass
      AND conname = 'ps_evaluations_role_change_check'
  ) THEN
    ALTER TABLE public.ps_evaluations
      ADD CONSTRAINT ps_evaluations_role_change_check
      CHECK (
        role_changed = false
        OR (
          nullif(trim(reported_role), '') IS NOT NULL
          AND nullif(trim(role_change_justification), '') IS NOT NULL
        )
      );
  END IF;
END $$;

DROP INDEX IF EXISTS public.ps_evaluations_event_collaborator_unique;
CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluations_event_collaborator_level_unique
  ON public.ps_evaluations (event_id, collaborator_id, evaluation_level)
  WHERE collaborator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ps_evaluations_evaluator_event_collaborator_idx
  ON public.ps_evaluations (evaluator_event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_evaluations_level_idx
  ON public.ps_evaluations (event_id, evaluation_level);

CREATE TABLE IF NOT EXISTS public.ps_event_collaborator_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  source text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  justification text,
  reported_by_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE SET NULL,
  reported_by_name text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_event_collaborator_adjustments_type_check
    CHECK (adjustment_type IN ('role', 'pix')),
  CONSTRAINT ps_event_collaborator_adjustments_source_check
    CHECK (source IN ('attendance', 'evaluation')),
  CONSTRAINT ps_event_collaborator_adjustments_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS ps_event_collaborator_adjustments_event_idx
  ON public.ps_event_collaborator_adjustments (event_id);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_adjustments_collaborator_idx
  ON public.ps_event_collaborator_adjustments (event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_adjustments_type_idx
  ON public.ps_event_collaborator_adjustments (adjustment_type);
CREATE INDEX IF NOT EXISTS ps_event_collaborator_adjustments_status_idx
  ON public.ps_event_collaborator_adjustments (status);

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS attendance_role_snapshot text,
  ADD COLUMN IF NOT EXISTS attendance_pix_snapshot text,
  ADD COLUMN IF NOT EXISTS attendance_pix_confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ps_attendance_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  responsible_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE SET NULL,
  responsible_name text NOT NULL,
  reason text,
  signature_url text NOT NULL,
  signature_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_attendance_absences_event_collaborator_unique
  ON public.ps_attendance_absences (event_id, event_collaborator_id);
CREATE INDEX IF NOT EXISTS ps_attendance_absences_event_idx
  ON public.ps_attendance_absences (event_id);

CREATE TABLE IF NOT EXISTS public.ps_attendance_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  campus text,
  building text NOT NULL,
  coordinator_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE SET NULL,
  coordinator_name text NOT NULL,
  signature_url text NOT NULL,
  signature_ip text,
  present_count integer NOT NULL DEFAULT 0,
  absent_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  role_adjustments_count integer NOT NULL DEFAULT 0,
  pix_adjustments_count integer NOT NULL DEFAULT 0,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_attendance_closures_event_location_unique
  ON public.ps_attendance_closures (event_id, coalesce(campus, ''), building);
CREATE INDEX IF NOT EXISTS ps_attendance_closures_event_idx
  ON public.ps_attendance_closures (event_id);

ALTER TABLE public.ps_self_evaluations
  ADD COLUMN IF NOT EXISTS campus text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS room text;

CREATE TABLE IF NOT EXISTS public.ps_confirmation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  event_collaborator_id uuid NOT NULL REFERENCES public.ps_event_collaborators(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  decline_reason text,
  replacement_event_collaborator_id uuid REFERENCES public.ps_event_collaborators(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'system',
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ps_confirmation_history_event_idx
  ON public.ps_confirmation_history (event_id, created_at);
CREATE INDEX IF NOT EXISTS ps_confirmation_history_collaborator_idx
  ON public.ps_confirmation_history (event_collaborator_id, created_at);

CREATE OR REPLACE FUNCTION public.ps_record_confirmation_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_replacement_id uuid;
BEGIN
  IF NEW.participation_status IS DISTINCT FROM OLD.participation_status THEN
    IF NEW.participation_status = 'replaced' THEN
      SELECT id INTO v_replacement_id
      FROM public.ps_event_collaborators
      WHERE replacement_for_event_collaborator_id = NEW.id
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    INSERT INTO public.ps_confirmation_history (
      event_id,
      event_collaborator_id,
      previous_status,
      new_status,
      decline_reason,
      replacement_event_collaborator_id,
      actor_name
    ) VALUES (
      NEW.event_id,
      NEW.id,
      OLD.participation_status,
      NEW.participation_status,
      NEW.decline_reason,
      v_replacement_id,
      NEW.collaborator_name
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_record_confirmation_history() FROM PUBLIC;
DROP TRIGGER IF EXISTS ps_event_collaborators_confirmation_history ON public.ps_event_collaborators;
CREATE TRIGGER ps_event_collaborators_confirmation_history
AFTER UPDATE OF participation_status ON public.ps_event_collaborators
FOR EACH ROW EXECUTE FUNCTION public.ps_record_confirmation_history();

DROP TRIGGER IF EXISTS ps_event_evaluator_scopes_updated ON public.ps_event_evaluator_scopes;
CREATE TRIGGER ps_event_evaluator_scopes_updated
BEFORE UPDATE ON public.ps_event_evaluator_scopes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS ps_event_collaborator_adjustments_updated ON public.ps_event_collaborator_adjustments;
CREATE TRIGGER ps_event_collaborator_adjustments_updated
BEFORE UPDATE ON public.ps_event_collaborator_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_event_evaluator_scopes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluation_scope_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_event_collaborator_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_attendance_absences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_attendance_closures TO authenticated;
GRANT SELECT ON public.ps_confirmation_history TO authenticated;
GRANT ALL ON public.ps_event_evaluator_scopes TO service_role;
GRANT ALL ON public.ps_evaluation_scope_overrides TO service_role;
GRANT ALL ON public.ps_event_collaborator_adjustments TO service_role;
GRANT ALL ON public.ps_attendance_absences TO service_role;
GRANT ALL ON public.ps_attendance_closures TO service_role;
GRANT ALL ON public.ps_confirmation_history TO service_role;

ALTER TABLE public.ps_event_evaluator_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_evaluation_scope_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_event_collaborator_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_attendance_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_attendance_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_confirmation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_event_evaluator_scopes internal manage"
  ON public.ps_event_evaluator_scopes FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evaluation_scope_overrides internal manage"
  ON public.ps_evaluation_scope_overrides FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_event_collaborator_adjustments internal manage"
  ON public.ps_event_collaborator_adjustments FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_attendance_absences internal manage"
  ON public.ps_attendance_absences FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_attendance_closures internal manage"
  ON public.ps_attendance_closures FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_confirmation_history internal read"
  ON public.ps_confirmation_history FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));