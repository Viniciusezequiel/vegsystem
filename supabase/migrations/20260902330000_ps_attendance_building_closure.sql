CREATE OR REPLACE FUNCTION public.ps_admin_close_attendance_building(
  p_event_id uuid,
  p_campus text,
  p_building text,
  p_coordinator_event_collaborator_id uuid,
  p_signature text
)
RETURNS TABLE(
  success boolean,
  message text,
  present_count integer,
  absent_count integer,
  pending_count integer,
  role_adjustments_count integer,
  pix_adjustments_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coordinator public.ps_event_collaborators%ROWTYPE;
  v_role text;

  v_present integer := 0;
  v_absent integer := 0;
  v_pending integer := 0;
  v_role_adjustments integer := 0;
  v_pix_adjustments integer := 0;

  v_existing uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_internal_user(auth.uid())
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF nullif(trim(coalesce(p_building, '')), '') IS NULL THEN
    RETURN QUERY
    SELECT false, 'Prédio/local inválido.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  IF p_signature !~
    '^r2/signatures/process-selection/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}-[0-9a-f]{16}\.png$'
  THEN
    RETURN QUERY
    SELECT false, 'Assinatura inválida.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT *
  INTO v_coordinator
  FROM public.ps_event_collaborators
  WHERE id = p_coordinator_event_collaborator_id
    AND event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT false, 'Coordenador não encontrado neste evento.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  v_role := lower(
    coalesce(
      v_coordinator.role_name,
      v_coordinator.assigned_role,
      v_coordinator.role_value,
      ''
    )
  );

  -- Coordenador somente. Subcoordenador não pode fechar o prédio.
  IF v_role NOT LIKE '%coord%'
     OR v_role LIKE '%sub%'
  THEN
    RETURN QUERY
    SELECT false, 'O fechamento final deve ser assinado por um Coordenador.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT c.id
  INTO v_existing
  FROM public.ps_attendance_closures c
  WHERE c.event_id = p_event_id
    AND coalesce(trim(c.campus), '') =
        coalesce(trim(p_campus), '')
    AND trim(c.building) = trim(p_building)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY
    SELECT false, 'Este prédio/local já possui fechamento registrado.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  WITH location_rows AS (
    SELECT ec.*
    FROM public.ps_event_collaborators ec
    WHERE ec.event_id = p_event_id
      AND coalesce(trim(ec.campus), '') =
          coalesce(trim(p_campus), '')
      AND coalesce(
        nullif(trim(ec.building), ''),
        nullif(trim(ec.unit), ''),
        nullif(trim(ec.campus), ''),
        'Sem prédio'
      ) = trim(p_building)
  )
  SELECT
    count(*) FILTER (
      WHERE coalesce(absent, false) = false
        AND (
          signed_at IS NOT NULL
          OR coalesce(present, false) = true
        )
    ),
    count(*) FILTER (
      WHERE coalesce(absent, false) = true
    ),
    count(*) FILTER (
      WHERE coalesce(absent, false) = false
        AND signed_at IS NULL
        AND coalesce(present, false) = false
    )
  INTO
    v_present,
    v_absent,
    v_pending
  FROM location_rows;

  IF (v_present + v_absent + v_pending) = 0 THEN
    RETURN QUERY
    SELECT false, 'Nenhum fiscal encontrado neste prédio/local.', 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  IF v_pending > 0 THEN
    RETURN QUERY
    SELECT
      false,
      format(
        'Ainda existem %s fiscal(is) pendente(s) neste prédio/local.',
        v_pending
      ),
      v_present,
      v_absent,
      v_pending,
      0,
      0;
    RETURN;
  END IF;

  SELECT
    count(*) FILTER (WHERE a.adjustment_type = 'role'),
    count(*) FILTER (WHERE a.adjustment_type = 'pix')
  INTO
    v_role_adjustments,
    v_pix_adjustments
  FROM public.ps_event_collaborator_adjustments a
  JOIN public.ps_event_collaborators ec
    ON ec.id = a.event_collaborator_id
  WHERE a.event_id = p_event_id
    AND a.source = 'attendance'
    AND coalesce(trim(ec.campus), '') =
        coalesce(trim(p_campus), '')
    AND coalesce(
      nullif(trim(ec.building), ''),
      nullif(trim(ec.unit), ''),
      nullif(trim(ec.campus), ''),
      'Sem prédio'
    ) = trim(p_building);

  INSERT INTO public.ps_attendance_closures (
    event_id,
    campus,
    building,
    coordinator_event_collaborator_id,
    coordinator_name,
    signature_url,
    present_count,
    absent_count,
    pending_count,
    role_adjustments_count,
    pix_adjustments_count,
    signed_at
  )
  VALUES (
    p_event_id,
    nullif(trim(coalesce(p_campus, '')), ''),
    trim(p_building),
    v_coordinator.id,
    v_coordinator.collaborator_name,
    p_signature,
    v_present,
    v_absent,
    v_pending,
    v_role_adjustments,
    v_pix_adjustments,
    now()
  );

  RETURN QUERY
  SELECT
    true,
    'Fechamento registrado com sucesso.',
    v_present,
    v_absent,
    v_pending,
    v_role_adjustments,
    v_pix_adjustments;
END;
$$;


REVOKE ALL ON FUNCTION public.ps_admin_close_attendance_building(
  uuid, text, text, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ps_admin_close_attendance_building(
  uuid, text, text, uuid, text
) TO authenticated;
