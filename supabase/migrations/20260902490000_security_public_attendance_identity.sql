-- ============================================================
-- SEGURANÇA DA PRESENÇA PÚBLICA
--
-- O UUID público identifica o vínculo, mas não autentica a pessoa.
-- Agora cargo/PIX, alterações e assinatura exigem confirmação
-- do CPF pertencente ao próprio vínculo.
--
-- Tentativas incorretas são limitadas usando o rate limiter
-- persistente já existente.
-- ============================================================


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
  v_supplied :=
    regexp_replace(
      coalesce(p_cpf, ''),
      '[^0-9]',
      '',
      'g'
    );

  SELECT
    regexp_replace(
      coalesce(
        nullif(trim(ec.cpf), ''),
        nullif(trim(c.cpf), ''),
        ''
      ),
      '[^0-9]',
      '',
      'g'
    )
  INTO v_expected
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e
    ON e.id = ec.event_id
  LEFT JOIN public.ps_collaborators c
    ON c.id = ec.collaborator_id
  WHERE ec.id = p_link_id
    AND ec.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND coalesce(
      e.hidden_from_evaluation,
      false
    ) = false;

  IF
    length(v_expected) = 11
    AND length(v_supplied) = 11
    AND v_supplied = v_expected
  THEN
    DELETE FROM public.public_api_rate_limits
    WHERE endpoint = 'ps-attendance-identity'
      AND client_hash = p_link_id::text;

    RETURN true;
  END IF;

  SELECT allowed
  INTO v_allowed
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


REVOKE ALL
ON FUNCTION public.ps_public_verify_attendance_identity(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_verify_attendance_identity(uuid, text)
TO service_role;


-- ============================================================
-- DETALHES DE PRESENÇA
-- ============================================================

CREATE OR REPLACE FUNCTION public.ps_public_get_attendance_details(
  p_link_id uuid,
  p_cpf text
)
RETURNS TABLE(
  event_collaborator_id uuid,
  role_value text,
  role_name text,
  pix_masked text,
  pix_configured boolean,
  details_confirmed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.ps_public_verify_attendance_identity(
    p_link_id,
    p_cpf
  ) THEN
    RAISE EXCEPTION 'identity_not_verified';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.ps_public_get_attendance_details(
    p_link_id
  );
END;
$$;


-- A versão antiga baseada somente em UUID deixa de ser pública.
REVOKE ALL
ON FUNCTION public.ps_public_get_attendance_details(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_get_attendance_details(uuid)
TO service_role;

REVOKE ALL
ON FUNCTION public.ps_public_get_attendance_details(uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_get_attendance_details(uuid, text)
TO anon, authenticated, service_role;


-- ============================================================
-- CONFIRMAÇÃO / ALTERAÇÃO CARGO + PIX
-- ============================================================

CREATE OR REPLACE FUNCTION public.ps_public_confirm_attendance_details(
  p_link_id uuid,
  p_cpf text,
  p_role_changed boolean DEFAULT false,
  p_role_value text DEFAULT NULL,
  p_pix_changed boolean DEFAULT false,
  p_pix text DEFAULT NULL,
  p_justification text DEFAULT NULL
)
RETURNS TABLE(
  success boolean,
  message text,
  confirmed_role text,
  confirmed_pix_masked text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.ps_public_verify_attendance_identity(
    p_link_id,
    p_cpf
  ) THEN
    RAISE EXCEPTION 'identity_not_verified';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.ps_public_confirm_attendance_details(
    p_link_id,
    p_role_changed,
    p_role_value,
    p_pix_changed,
    p_pix,
    p_justification
  );
END;
$$;


-- Versão antiga sem confirmação de identidade.
REVOKE ALL
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  boolean,
  text,
  boolean,
  text,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  boolean,
  text,
  boolean,
  text,
  text
)
TO service_role;


REVOKE ALL
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  text,
  boolean,
  text,
  boolean,
  text,
  text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  text,
  boolean,
  text,
  boolean,
  text,
  text
)
TO anon, authenticated, service_role;
