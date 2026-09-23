-- Impede que um substituto seja escalado em dois processos no mesmo dia.
-- A regra considera somente vínculos operacionais (aguardando confirmação ou confirmados).
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
  v_event_date date;
BEGIN
  SELECT *
    INTO v_old
    FROM public.ps_event_collaborators
   WHERE id = p_old_link_id
   FOR UPDATE;

  IF NOT FOUND OR v_old.participation_status = 'replaced' THEN
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

  SELECT date
    INTO v_event_date
    FROM public.ps_events
   WHERE id = v_old.event_id;

  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'event_date_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.ps_event_collaborators ec
      JOIN public.ps_events e
        ON e.id = ec.event_id
     WHERE ec.collaborator_id = p_new_collaborator_id
       AND ec.event_id <> v_old.event_id
       AND e.date = v_event_date
       AND ec.participation_status IN ('pending_confirmation', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'collaborator_has_same_day_assignment';
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
    coalesce(nullif(trim(p_assignment ->> 'role_value'), ''), v_old.role_value),
    coalesce(nullif(trim(p_assignment ->> 'role_name'), ''), v_old.role_name),
    coalesce(nullif(trim(p_assignment ->> 'assigned_role'), ''), v_old.assigned_role),
    CASE
      WHEN nullif(trim(p_assignment ->> 'pay_value'), '') IS NOT NULL
      THEN (p_assignment ->> 'pay_value')::numeric
      ELSE v_old.pay_value
    END,
    coalesce(nullif(trim(p_assignment ->> 'sector'), ''), v_old.sector),
    coalesce(nullif(trim(p_assignment ->> 'campus'), ''), v_old.campus),
    coalesce(nullif(trim(p_assignment ->> 'unit'), ''), v_old.unit),
    coalesce(nullif(trim(p_assignment ->> 'institution'), ''), v_old.institution),
    coalesce(nullif(trim(p_assignment ->> 'building'), ''), v_old.building),
    coalesce(nullif(trim(p_assignment ->> 'floor'), ''), v_old.floor),
    coalesce(nullif(trim(p_assignment ->> 'room'), ''), v_old.room),
    coalesce(nullif(trim(p_assignment ->> 'work_schedule'), ''), v_old.work_schedule),
    v_new_collaborator.cpf,
    v_new_collaborator.identity_doc,
    v_new_collaborator.email,
    v_new_collaborator.phone,
    v_new_collaborator.mobile,
    v_new_collaborator.pix,
    'pending_confirmation',
    v_old.id,
    coalesce(v_old.original_event_collaborator_id, v_old.id)
  )
  RETURNING id INTO v_new_id;

  UPDATE public.ps_event_collaborators
     SET participation_status = 'replaced',
         public_confirmation_token_revoked_at = now()
   WHERE id = v_old.id;

  RETURN QUERY
  SELECT v_old.id, v_new_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.ps_replace_event_collaborator(uuid, uuid, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.ps_replace_event_collaborator(uuid, uuid, jsonb)
TO authenticated;
