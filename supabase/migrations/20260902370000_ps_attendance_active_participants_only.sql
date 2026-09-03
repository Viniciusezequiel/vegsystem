-- Presença pública somente para integrantes da equipe operacional atual.
-- Recusados e substituídos permanecem no histórico, mas não podem
-- consultar, alterar dados ou registrar presença novamente.

CREATE OR REPLACE FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_signature IS NULL OR p_signature !~ '^r2/signatures/process-selection/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}-[0-9a-f]{16}\.png$' THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  UPDATE public.ps_event_collaborators ec
  SET signature_url = p_signature, signed_at = now(), present = true, absent = false
  WHERE ec.id = p_link_id
    AND ec.signed_at IS NULL
    AND ec.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND EXISTS (
      SELECT 1 FROM public.ps_events e
      WHERE e.id = ec.event_id AND COALESCE(e.hidden_from_evaluation, false) = false
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado ou já assinado'; END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.ps_public_get_attendance_details(
  p_link_id uuid
)
RETURNS TABLE(
  event_collaborator_id uuid,
  role_value text,
  role_name text,
  pix_masked text,
  pix_configured boolean,
  details_confirmed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ec.id,
    coalesce(
      ec.attendance_role_snapshot,
      ec.role_value,
      ec.assigned_role
    ),
    coalesce(
      r.name,
      ec.role_name,
      ec.assigned_role,
      'Cargo não informado'
    ),
    public.ps_mask_attendance_pix(
      coalesce(ec.attendance_pix_snapshot, ec.pix)
    ),
    nullif(
      trim(coalesce(ec.attendance_pix_snapshot, ec.pix)),
      ''
    ) IS NOT NULL,
    ec.attendance_pix_confirmed_at IS NOT NULL
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e
    ON e.id = ec.event_id
  LEFT JOIN public.ps_roles r
    ON r.value = coalesce(
      ec.attendance_role_snapshot,
      ec.role_value
    )
  WHERE ec.id = p_link_id
    AND ec.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND coalesce(e.hidden_from_evaluation, false) = false;
$$;


CREATE OR REPLACE FUNCTION public.ps_public_confirm_attendance_details(
  p_link_id uuid,
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
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_current_pix text;
  v_new_pix text;
  v_role_snapshot text;
  v_old_role_label text;
  v_new_role_label text;
  v_reason text;
BEGIN
  SELECT ec.*
  INTO v_link
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e
    ON e.id = ec.event_id
  WHERE ec.id = p_link_id
    AND ec.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )
    AND coalesce(e.hidden_from_evaluation, false) = false
  FOR UPDATE OF ec;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'Fiscal não encontrado.', NULL::text, NULL::text;
    RETURN;
  END IF;

  IF v_link.signed_at IS NOT NULL THEN
    RETURN QUERY
    SELECT false, 'A presença deste fiscal já foi registrada.', NULL::text, NULL::text;
    RETURN;
  END IF;

  v_current_pix := coalesce(
    v_link.attendance_pix_snapshot,
    v_link.pix
  );

  v_new_pix := v_current_pix;

  v_role_snapshot := coalesce(
    v_link.attendance_role_snapshot,
    v_link.role_value,
    v_link.assigned_role,
    v_link.role_name
  );

  v_old_role_label := coalesce(
    v_link.role_name,
    v_link.assigned_role,
    v_link.role_value,
    'Não informado'
  );

  v_reason := nullif(trim(coalesce(p_justification, '')), '');

  IF p_role_changed THEN
    IF nullif(trim(coalesce(p_role_value, '')), '') IS NULL THEN
      RETURN QUERY
      SELECT false, 'Selecione o novo cargo.', NULL::text, NULL::text;
      RETURN;
    END IF;

    IF v_reason IS NULL THEN
      RETURN QUERY
      SELECT false, 'Informe o motivo da alteração.', NULL::text, NULL::text;
      RETURN;
    END IF;

    SELECT r.name
    INTO v_new_role_label
    FROM public.ps_roles r
    WHERE r.value = p_role_value;

    IF v_new_role_label IS NULL THEN
      RETURN QUERY
      SELECT false, 'Cargo selecionado é inválido.', NULL::text, NULL::text;
      RETURN;
    END IF;

    IF p_role_value IS DISTINCT FROM v_role_snapshot THEN
      INSERT INTO public.ps_event_collaborator_adjustments (
        event_id,
        event_collaborator_id,
        adjustment_type,
        source,
        old_value,
        new_value,
        justification,
        reported_by_event_collaborator_id,
        reported_by_name,
        status
      )
      VALUES (
        v_link.event_id,
        v_link.id,
        'role',
        'attendance',
        v_old_role_label,
        v_new_role_label,
        v_reason,
        v_link.id,
        v_link.collaborator_name,
        'pending'
      );
    END IF;

    v_role_snapshot := p_role_value;
  ELSE
    v_new_role_label := v_old_role_label;
  END IF;

  IF p_pix_changed THEN
    v_new_pix := nullif(trim(coalesce(p_pix, '')), '');

    IF v_new_pix IS NULL THEN
      RETURN QUERY
      SELECT false, 'Informe o novo PIX.', NULL::text, NULL::text;
      RETURN;
    END IF;

    IF v_reason IS NULL THEN
      RETURN QUERY
      SELECT false, 'Informe o motivo da alteração.', NULL::text, NULL::text;
      RETURN;
    END IF;

    IF v_new_pix IS DISTINCT FROM v_current_pix THEN
      INSERT INTO public.ps_event_collaborator_adjustments (
        event_id,
        event_collaborator_id,
        adjustment_type,
        source,
        old_value,
        new_value,
        justification,
        reported_by_event_collaborator_id,
        reported_by_name,
        status
      )
      VALUES (
        v_link.event_id,
        v_link.id,
        'pix',
        'attendance',
        v_current_pix,
        v_new_pix,
        v_reason,
        v_link.id,
        v_link.collaborator_name,
        'pending'
      );
    END IF;
  END IF;

  IF nullif(trim(coalesce(v_new_pix, '')), '') IS NULL THEN
    RETURN QUERY
    SELECT false, 'PIX não cadastrado. Informe o PIX para continuar.', NULL::text, NULL::text;
    RETURN;
  END IF;

  UPDATE public.ps_event_collaborators
  SET
    attendance_role_snapshot = v_role_snapshot,
    attendance_pix_snapshot = v_new_pix,
    attendance_pix_confirmed_at = now()
  WHERE id = v_link.id;

  RETURN QUERY
  SELECT
    true,
    'Dados conferidos com sucesso.',
    coalesce(v_new_role_label, v_old_role_label),
    public.ps_mask_attendance_pix(v_new_pix);
END;
$$;



REVOKE ALL
ON FUNCTION public.ps_public_sign_attendance(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_sign_attendance(uuid, text)
TO service_role;


REVOKE ALL
ON FUNCTION public.ps_public_get_attendance_details(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  boolean,
  text,
  boolean,
  text,
  text
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_get_attendance_details(uuid)
TO anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.ps_public_confirm_attendance_details(
  uuid,
  boolean,
  text,
  boolean,
  text,
  text
)
TO anon, authenticated;
