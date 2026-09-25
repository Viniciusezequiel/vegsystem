-- Lista pública de presença: somente a equipe operacional atual.
-- Expõe somente os campos operacionais mínimos necessários para a presença.

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
