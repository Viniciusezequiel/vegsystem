CREATE OR REPLACE FUNCTION public.ps_admin_register_attendance_absence(
  p_event_collaborator_id uuid,
  p_responsible_event_collaborator_id uuid,
  p_reason text,
  p_signature text
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.ps_event_collaborators%ROWTYPE;
  v_responsible public.ps_event_collaborators%ROWTYPE;
  v_responsible_role text;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'analista')
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT *
  INTO v_target
  FROM public.ps_event_collaborators
  WHERE id = p_event_collaborator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Fiscal não encontrado.';
    RETURN;
  END IF;

  IF v_target.signed_at IS NOT NULL THEN
    RETURN QUERY
    SELECT false, 'Este fiscal já assinou a presença. Use Refazer assinatura antes de registrar ausência.';
    RETURN;
  END IF;

  SELECT *
  INTO v_responsible
  FROM public.ps_event_collaborators
  WHERE id = p_responsible_event_collaborator_id
    AND event_id = v_target.event_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Responsável não encontrado neste evento.';
    RETURN;
  END IF;

  v_responsible_role := lower(
    coalesce(
      v_responsible.role_name,
      v_responsible.assigned_role,
      v_responsible.role_value,
      ''
    )
  );

  IF v_responsible_role NOT LIKE '%coord%' THEN
    RETURN QUERY
    SELECT false, 'O responsável deve ser coordenador ou subcoordenador.';
    RETURN;
  END IF;

  IF p_signature !~ '^r2/signatures/process-selection/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}-[0-9a-f]{16}\.png$' THEN
    RETURN QUERY SELECT false, 'Assinatura do responsável inválida.';
    RETURN;
  END IF;

  INSERT INTO public.ps_attendance_absences (
    event_id,
    event_collaborator_id,
    responsible_event_collaborator_id,
    responsible_name,
    reason,
    signature_url,
    created_at
  )
  VALUES (
    v_target.event_id,
    v_target.id,
    v_responsible.id,
    v_responsible.collaborator_name,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_signature,
    now()
  )
  ON CONFLICT (event_id, event_collaborator_id)
  DO UPDATE SET
    responsible_event_collaborator_id = EXCLUDED.responsible_event_collaborator_id,
    responsible_name = EXCLUDED.responsible_name,
    reason = EXCLUDED.reason,
    signature_url = EXCLUDED.signature_url,
    created_at = now();

  UPDATE public.ps_event_collaborators
  SET
    absent = true,
    present = false,
    departed_at = null
  WHERE id = v_target.id;

  RETURN QUERY
  SELECT true, 'Ausência registrada com sucesso.';
END;
$$;


CREATE OR REPLACE FUNCTION public.ps_admin_cancel_attendance_absence(
  p_event_collaborator_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'analista')
     )
  THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.ps_attendance_absences
  WHERE event_collaborator_id = p_event_collaborator_id;

  UPDATE public.ps_event_collaborators
  SET
    absent = false,
    present = false,
    departed_at = null
  WHERE id = p_event_collaborator_id;

  RETURN FOUND;
END;
$$;


REVOKE ALL ON FUNCTION public.ps_admin_register_attendance_absence(uuid, uuid, text, text)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.ps_admin_cancel_attendance_absence(uuid)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ps_admin_register_attendance_absence(uuid, uuid, text, text)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.ps_admin_cancel_attendance_absence(uuid)
TO authenticated;
