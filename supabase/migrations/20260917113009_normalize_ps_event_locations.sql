CREATE OR REPLACE FUNCTION public.ps_normalize_event_location(
  p_value text,
  p_building boolean DEFAULT false
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH folded AS (
    SELECT translate(
        upper(trim(coalesce(p_value, ''))),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ) AS value
  ), prepared AS (
    SELECT CASE
      WHEN value IN ('', '-', '—', 'N/A', 'NA', 'NAO INFORMADO', 'NAO INFORMADA', 'SEM INFORMACAO')
        THEN ''
      WHEN p_building
        THEN regexp_replace(value, '^PREDIO[[:space:]]*([-–—:][[:space:]]*)?', '', 'i')
      ELSE value
    END AS value
    FROM folded
  )
  SELECT regexp_replace(
    trim(regexp_replace(value, '[^A-Z0-9]+', ' ', 'g')),
    '[[:space:]]+',
    ' ',
    'g'
  )
  FROM prepared;
$$;

REVOKE ALL ON FUNCTION public.ps_normalize_event_location(text, boolean)
  FROM PUBLIC, anon, authenticated;

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
  v_campus_key text;
  v_building_key text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.is_internal_user(auth.uid())
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_campus_key := public.ps_normalize_event_location(p_campus, false);
  v_building_key := public.ps_normalize_event_location(p_building, true);

  IF nullif(v_building_key, '') IS NULL THEN
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
    AND public.ps_normalize_event_location(c.campus, false) = v_campus_key
    AND public.ps_normalize_event_location(c.building, true) = v_building_key
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
      AND public.ps_normalize_event_location(ec.campus, false) = v_campus_key
      AND coalesce(
        nullif(public.ps_normalize_event_location(ec.building, true), ''),
        nullif(public.ps_normalize_event_location(ec.unit, true), ''),
        nullif(public.ps_normalize_event_location(ec.campus, true), ''),
        'SEM PREDIO'
      ) = v_building_key
  )
  SELECT
    count(*) FILTER (
      WHERE coalesce(absent, false) = false
        AND (signed_at IS NOT NULL OR coalesce(present, false) = true)
    ),
    count(*) FILTER (WHERE coalesce(absent, false) = true),
    count(*) FILTER (
      WHERE coalesce(absent, false) = false
        AND signed_at IS NULL
        AND coalesce(present, false) = false
    )
  INTO v_present, v_absent, v_pending
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
      format('Ainda existem %s fiscal(is) pendente(s) neste prédio/local.', v_pending),
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
  INTO v_role_adjustments, v_pix_adjustments
  FROM public.ps_event_collaborator_adjustments a
  JOIN public.ps_event_collaborators ec
    ON ec.id = a.event_collaborator_id
  WHERE a.event_id = p_event_id
    AND a.source = 'attendance'
    AND public.ps_normalize_event_location(ec.campus, false) = v_campus_key
    AND coalesce(
      nullif(public.ps_normalize_event_location(ec.building, true), ''),
      nullif(public.ps_normalize_event_location(ec.unit, true), ''),
      nullif(public.ps_normalize_event_location(ec.campus, true), ''),
      'SEM PREDIO'
    ) = v_building_key;

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
    nullif(v_campus_key, ''),
    v_building_key,
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
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ps_admin_close_attendance_building(
  uuid, text, text, uuid, text
) TO authenticated;
