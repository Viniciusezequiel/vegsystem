-- Integridade das substituições de fiscais:
-- preserva posto/localização e usa dados pessoais do novo colaborador.

-- Corrige substituições antigas que ficaram sem localização completa.
UPDATE public.ps_event_collaborators new_link
SET
  campus = CASE
    WHEN nullif(trim(coalesce(new_link.campus, '')), '') IS NULL
      THEN old_link.campus
    ELSE new_link.campus
  END,
  sector = CASE
    WHEN nullif(trim(coalesce(new_link.sector, '')), '') IS NULL
      THEN old_link.sector
    ELSE new_link.sector
  END,
  unit = CASE
    WHEN nullif(trim(coalesce(new_link.unit, '')), '') IS NULL
      THEN old_link.unit
    ELSE new_link.unit
  END,
  institution = CASE
    WHEN nullif(trim(coalesce(new_link.institution, '')), '') IS NULL
      THEN old_link.institution
    ELSE new_link.institution
  END,
  building = CASE
    WHEN nullif(trim(coalesce(new_link.building, '')), '') IS NULL
      THEN old_link.building
    ELSE new_link.building
  END,
  floor = CASE
    WHEN nullif(trim(coalesce(new_link.floor, '')), '') IS NULL
      THEN old_link.floor
    ELSE new_link.floor
  END,
  room = CASE
    WHEN nullif(trim(coalesce(new_link.room, '')), '') IS NULL
      THEN old_link.room
    ELSE new_link.room
  END,
  work_schedule = CASE
    WHEN nullif(trim(coalesce(new_link.work_schedule, '')), '') IS NULL
      THEN old_link.work_schedule
    ELSE new_link.work_schedule
  END
FROM public.ps_event_collaborators old_link
WHERE
  new_link.replacement_for_event_collaborator_id = old_link.id;


-- Corrige dados pessoais dos substitutos existentes.
UPDATE public.ps_event_collaborators event_link
SET
  cpf = coalesce(
    nullif(trim(event_link.cpf), ''),
    collaborator.cpf
  ),
  identity_doc = coalesce(
    nullif(trim(event_link.identity_doc), ''),
    collaborator.identity_doc
  ),
  email = coalesce(
    nullif(trim(event_link.email), ''),
    collaborator.email
  ),
  phone = coalesce(
    nullif(trim(event_link.phone), ''),
    collaborator.phone
  ),
  mobile = coalesce(
    nullif(trim(event_link.mobile), ''),
    collaborator.mobile
  ),
  pix = coalesce(
    nullif(trim(event_link.pix), ''),
    collaborator.pix
  )
FROM public.ps_collaborators collaborator
WHERE
  event_link.collaborator_id = collaborator.id
  AND event_link.replacement_for_event_collaborator_id IS NOT NULL;


-- =========================================================
-- CONFIRMAÇÃO
-- =========================================================

CREATE OR REPLACE FUNCTION public.ps_request_event_collaborator_confirmation(
  p_link_id uuid,
  p_rotate boolean DEFAULT false,
  p_ttl interval DEFAULT interval '72 hours'
)
RETURNS TABLE(
  token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
  v_current_expires_at timestamptz;
  v_status text;
BEGIN
  IF p_ttl <= interval '5 minutes'
     OR p_ttl > interval '14 days'
  THEN
    RAISE EXCEPTION 'invalid_confirmation_ttl';
  END IF;

  SELECT
    ec.public_confirmation_token_expires_at,
    ec.participation_status
  INTO
    v_current_expires_at,
    v_status
  FROM public.ps_event_collaborators ec
  WHERE ec.id = p_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_collaborator_not_found';
  END IF;

  IF v_status = 'replaced' THEN
    RAISE EXCEPTION
      'replaced_collaborator_cannot_be_reactivated';
  END IF;

  IF v_status = 'confirmed' THEN
    RAISE EXCEPTION
      'collaborator_already_confirmed';
  END IF;

  IF NOT p_rotate
     AND v_current_expires_at > now()
  THEN
    RAISE EXCEPTION 'active_confirmation_token_exists';
  END IF;

  v_token :=
    encode(extensions.gen_random_bytes(32), 'hex');

  v_expires_at := now() + p_ttl;

  UPDATE public.ps_event_collaborators
  SET
    participation_status = 'pending_confirmation',
    confirmation_requested_at = now(),
    confirmed_at = NULL,
    declined_at = NULL,
    decline_reason = NULL,
    public_confirmation_token_hash =
      encode(
        extensions.digest(v_token, 'sha256'),
        'hex'
      ),
    public_confirmation_token_expires_at =
      v_expires_at,
    public_confirmation_token_revoked_at = NULL
  WHERE id = p_link_id;

  RETURN QUERY
  SELECT v_token, v_expires_at;
END;
$$;

REVOKE ALL
ON FUNCTION public.ps_request_event_collaborator_confirmation(
  uuid,
  boolean,
  interval
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.ps_request_event_collaborator_confirmation(
  uuid,
  boolean,
  interval
)
TO authenticated;


-- =========================================================
-- SUBSTITUIÇÃO
-- =========================================================

CREATE OR REPLACE FUNCTION public.ps_replace_event_collaborator(
  p_old_link_id uuid,
  p_new_collaborator_id uuid,
  p_assignment jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  old_link_id uuid,
  new_link_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.ps_event_collaborators%ROWTYPE;
  v_new_collaborator public.ps_collaborators%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT *
  INTO v_old
  FROM public.ps_event_collaborators
  WHERE id = p_old_link_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_old.participation_status = 'replaced'
  THEN
    RAISE EXCEPTION 'invalid_replacement_source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ps_event_collaborators
    WHERE event_id = v_old.event_id
      AND collaborator_id = p_new_collaborator_id
  ) THEN
    RAISE EXCEPTION 'collaborator_already_linked';
  END IF;

  SELECT *
  INTO v_new_collaborator
  FROM public.ps_collaborators
  WHERE id = p_new_collaborator_id
    AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_replacement_not_found';
  END IF;

  INSERT INTO public.ps_event_collaborators (
    event_id,
    collaborator_id,
    collaborator_name,
    role_value,
    role_name,
    assigned_role,
    pay_value,
    sector,
    campus,
    unit,
    institution,
    building,
    floor,
    room,
    work_schedule,
    cpf,
    identity_doc,
    email,
    phone,
    mobile,
    pix,
    participation_status,
    replacement_for_event_collaborator_id,
    original_event_collaborator_id
  )
  VALUES (
    v_old.event_id,
    p_new_collaborator_id,
    v_new_collaborator.full_name,

    coalesce(
      nullif(trim(p_assignment ->> 'role_value'), ''),
      v_old.role_value
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'role_name'), ''),
      v_old.role_name
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'assigned_role'), ''),
      v_old.assigned_role
    ),

    CASE
      WHEN nullif(
        trim(p_assignment ->> 'pay_value'),
        ''
      ) IS NOT NULL
      THEN (p_assignment ->> 'pay_value')::numeric
      ELSE v_old.pay_value
    END,

    coalesce(
      nullif(trim(p_assignment ->> 'sector'), ''),
      v_old.sector
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'campus'), ''),
      v_old.campus
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'unit'), ''),
      v_old.unit
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'institution'), ''),
      v_old.institution
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'building'), ''),
      v_old.building
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'floor'), ''),
      v_old.floor
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'room'), ''),
      v_old.room
    ),
    coalesce(
      nullif(trim(p_assignment ->> 'work_schedule'), ''),
      v_old.work_schedule
    ),

    v_new_collaborator.cpf,
    v_new_collaborator.identity_doc,
    v_new_collaborator.email,
    v_new_collaborator.phone,
    v_new_collaborator.mobile,
    v_new_collaborator.pix,

    'pending_confirmation',
    v_old.id,
    coalesce(
      v_old.original_event_collaborator_id,
      v_old.id
    )
  )
  RETURNING id INTO v_new_id;

  UPDATE public.ps_event_collaborators
  SET
    participation_status = 'replaced',
    public_confirmation_token_revoked_at = now()
  WHERE id = v_old.id;

  RETURN QUERY
  SELECT v_old.id, v_new_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.ps_replace_event_collaborator(
  uuid,
  uuid,
  jsonb
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.ps_replace_event_collaborator(
  uuid,
  uuid,
  jsonb
)
TO authenticated;
