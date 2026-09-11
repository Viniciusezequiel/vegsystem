-- Use the CPF stored in ps_collaborators as the canonical identity source.

CREATE OR REPLACE FUNCTION public.ps_public_verify_attendance_identity(
  p_link_id uuid,
  p_cpf text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected text;
  v_supplied text;
  v_allowed boolean;
BEGIN
  v_supplied := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');

  SELECT regexp_replace(
    coalesce(
      nullif(trim(c.cpf), ''),
      nullif(trim(ec.cpf), ''),
      ''
    ),
    '[^0-9]',
    '',
    'g'
  )
  INTO v_expected
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  LEFT JOIN public.ps_collaborators c ON c.id = ec.collaborator_id
  WHERE ec.id = p_link_id
    AND ec.participation_status IN ('pending_confirmation', 'confirmed')
    AND coalesce(e.hidden_from_evaluation, false) = false;

  IF length(v_expected) = 11
     AND length(v_supplied) = 11
     AND v_supplied = v_expected THEN
    DELETE FROM public.public_api_rate_limits
    WHERE endpoint = 'ps-attendance-identity'
      AND client_hash = p_link_id::text;
    RETURN true;
  END IF;

  SELECT allowed INTO v_allowed
  FROM public.consume_public_api_rate_limit(
    'ps-attendance-identity',
    p_link_id::text,
    5,
    300
  );

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'identity_rate_limited';
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_verify_attendance_identity(uuid, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_verify_attendance_identity(uuid, text)
TO service_role;

CREATE OR REPLACE FUNCTION public.ps_sync_evaluator_account_cpfs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_cpf text;
  v_updated integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.is_internal_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR v_account IN
    SELECT * FROM public.ps_evaluator_accounts FOR UPDATE
  LOOP
    SELECT regexp_replace(coalesce(c.cpf, ''), '[^0-9]', '', 'g')
      INTO v_cpf
    FROM public.ps_collaborators c
    WHERE c.id = v_account.collaborator_id;

    IF length(v_cpf) <> 11 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ps_evaluator_accounts other
      WHERE other.event_id = v_account.event_id
        AND other.username = v_cpf
        AND other.id <> v_account.id
    ) THEN
      CONTINUE;
    END IF;

    IF v_account.username IS DISTINCT FROM v_cpf THEN
      UPDATE public.ps_evaluator_accounts
      SET username = v_cpf,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = v_account.id;

      UPDATE public.ps_evaluator_sessions
      SET revoked_at = now()
      WHERE account_id = v_account.id
        AND revoked_at IS NULL;

      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_sync_evaluator_account_cpfs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_sync_evaluator_account_cpfs() TO authenticated, service_role;

-- Keep any already-created references aligned with the canonical CPF.
UPDATE public.ps_event_collaborators ec
SET cpf = c.cpf,
    updated_at = now()
FROM public.ps_collaborators c
WHERE ec.collaborator_id = c.id
  AND length(regexp_replace(coalesce(c.cpf, ''), '[^0-9]', '', 'g')) = 11
  AND ec.cpf IS DISTINCT FROM c.cpf;

DO $$
DECLARE
  v_account public.ps_evaluator_accounts%ROWTYPE;
  v_cpf text;
BEGIN
  FOR v_account IN SELECT * FROM public.ps_evaluator_accounts LOOP
    SELECT regexp_replace(coalesce(c.cpf, ''), '[^0-9]', '', 'g')
      INTO v_cpf
    FROM public.ps_collaborators c
    WHERE c.id = v_account.collaborator_id;

    IF length(v_cpf) = 11
       AND v_account.username IS DISTINCT FROM v_cpf
       AND NOT EXISTS (
         SELECT 1
         FROM public.ps_evaluator_accounts other
         WHERE other.event_id = v_account.event_id
           AND other.username = v_cpf
           AND other.id <> v_account.id
       ) THEN
      UPDATE public.ps_evaluator_accounts
      SET username = v_cpf,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = v_account.id;

      UPDATE public.ps_evaluator_sessions
      SET revoked_at = now()
      WHERE account_id = v_account.id
        AND revoked_at IS NULL;
    END IF;
  END LOOP;
END;
$$;
