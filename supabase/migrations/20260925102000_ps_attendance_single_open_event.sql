-- Presença pública: apenas um evento operacional por vez.
-- Eventos finalizados não aparecem nos metadados de presença e não expõem roster.

CREATE OR REPLACE FUNCTION public.ps_public_list_events(
  p_surface text DEFAULT 'attendance'
)
RETURNS TABLE(
  id uuid,
  name text,
  date date,
  status text,
  self_evaluation_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    e.id,
    e.name,
    e.date,
    e.status,
    coalesce(e.self_evaluation_enabled, false)
  FROM public.ps_events e
  WHERE
    coalesce(e.hidden_from_evaluation, false) = false
    AND (
      (
        p_surface = 'attendance'
        AND e.status <> 'finalizado'
      )
      OR (
        p_surface = 'self_evaluation'
        AND coalesce(e.self_evaluation_enabled, false) = true
        AND e.status <> 'finalizado'
      )
    )
  ORDER BY
    CASE
      WHEN p_surface = 'attendance' AND e.status = 'em_andamento' THEN 0
      WHEN p_surface = 'attendance' THEN 1
      ELSE 0
    END,
    CASE
      WHEN p_surface = 'attendance' THEN abs(e.date - current_date)
      ELSE 0
    END,
    e.date DESC,
    e.name
  LIMIT CASE
    WHEN p_surface = 'attendance' THEN 1
    ELSE 500
  END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_list_events(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_list_events(text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.ps_public_attendance_roster(
  p_event_id uuid,
  p_search text DEFAULT ''
)
RETURNS TABLE(
  id uuid,
  collaborator_name text,
  assigned_role text,
  role_name text,
  sector text,
  unit text,
  campus text,
  building text,
  floor text,
  room text,
  participation_status text,
  present boolean,
  absent boolean,
  signed_at timestamptz,
  departed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ec.id,
    ec.collaborator_name,
    ec.assigned_role,
    ec.role_name,
    ec.sector,
    ec.unit,
    ec.campus,
    ec.building,
    ec.floor,
    ec.room,
    ec.participation_status,
    ec.present,
    ec.absent,
    ec.signed_at,
    ec.departed_at
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  LEFT JOIN public.ps_collaborators c ON c.id = ec.collaborator_id
  WHERE ec.event_id = p_event_id
    AND e.status <> 'finalizado'
    AND COALESCE(e.hidden_from_evaluation, false) = false
    AND ec.participation_status IN ('pending_confirmation', 'confirmed')
    AND COALESCE(ec.manually_excluded, false) = false
    AND COALESCE(c.active, true) = true
    AND (
      trim(coalesce(p_search, '')) = ''
      OR ec.collaborator_name ILIKE '%' || trim(p_search) || '%'
      OR ec.role_name ILIKE '%' || trim(p_search) || '%'
      OR ec.assigned_role ILIKE '%' || trim(p_search) || '%'
      OR ec.sector ILIKE '%' || trim(p_search) || '%'
      OR ec.unit ILIKE '%' || trim(p_search) || '%'
      OR ec.campus ILIKE '%' || trim(p_search) || '%'
      OR ec.building ILIKE '%' || trim(p_search) || '%'
      OR ec.floor ILIKE '%' || trim(p_search) || '%'
      OR ec.room ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY ec.collaborator_name
  LIMIT 1000;
$$;

REVOKE ALL ON FUNCTION public.ps_public_attendance_roster(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_attendance_roster(uuid, text) TO anon, authenticated;
