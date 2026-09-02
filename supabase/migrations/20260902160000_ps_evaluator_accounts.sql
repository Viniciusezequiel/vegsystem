CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.ps_evaluator_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES public.ps_collaborators(id) ON DELETE RESTRICT,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ps_evaluator_accounts_role_check
    CHECK (role IN ('coordinator', 'subcoordinator')),
  CONSTRAINT ps_evaluator_accounts_username_check
    CHECK (nullif(trim(username), '') IS NOT NULL),
  CONSTRAINT ps_evaluator_accounts_password_hash_check
    CHECK (password_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluator_accounts_event_username_unique
  ON public.ps_evaluator_accounts (event_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluator_accounts_event_collaborator_unique
  ON public.ps_evaluator_accounts (event_id, collaborator_id);
CREATE INDEX IF NOT EXISTS ps_evaluator_accounts_event_role_active_idx
  ON public.ps_evaluator_accounts (event_id, role, active);
CREATE INDEX IF NOT EXISTS ps_evaluator_accounts_collaborator_idx
  ON public.ps_evaluator_accounts (collaborator_id);

CREATE OR REPLACE FUNCTION public.ps_admin_create_evaluator_account(
  p_event_id uuid,
  p_collaborator_id uuid,
  p_role text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_account_id uuid;
  v_username text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'evaluator_account_admin_required';
  END IF;
  IF p_role NOT IN ('coordinator', 'subcoordinator') THEN
    RAISE EXCEPTION 'invalid_evaluator_role';
  END IF;
  IF p_event_id IS NULL OR p_collaborator_id IS NULL THEN
    RAISE EXCEPTION 'evaluator_account_link_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ps_events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'evaluator_account_reference_not_found';
  END IF;
  SELECT nullif(regexp_replace(matricula, '[^0-9A-Za-z]', '', 'g'), '')
    INTO v_username
  FROM public.ps_collaborators
  WHERE id = p_collaborator_id;
  IF v_username IS NULL THEN
    RAISE EXCEPTION 'evaluator_account_matricula_required';
  END IF;

  INSERT INTO public.ps_evaluator_accounts (
    event_id,
    collaborator_id,
    username,
    password_hash,
    role,
    must_change_password
  ) VALUES (
    p_event_id,
    p_collaborator_id,
    v_username,
    extensions.crypt(v_username, extensions.gen_salt('bf', 12)),
    p_role,
    true
  )
  RETURNING id INTO v_account_id;

  RETURN v_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_admin_create_evaluator_account(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_admin_create_evaluator_account(uuid, uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS ps_evaluator_accounts_updated ON public.ps_evaluator_accounts;
CREATE TRIGGER ps_evaluator_accounts_updated
BEFORE UPDATE ON public.ps_evaluator_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, UPDATE, DELETE ON public.ps_evaluator_accounts TO authenticated;
GRANT ALL ON public.ps_evaluator_accounts TO service_role;

ALTER TABLE public.ps_evaluator_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evaluator_accounts admin manage"
  ON public.ps_evaluator_accounts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));