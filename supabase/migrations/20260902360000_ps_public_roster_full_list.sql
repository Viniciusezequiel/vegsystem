CREATE OR REPLACE FUNCTION public.ps_public_search_event_roster(
  p_event_id uuid,
  p_search text DEFAULT ''
)
RETURNS TABLE(
  id uuid,
  collaborator_id uuid,
  collaborator_name text,
  matricula_masked text,
  email_masked text,
  assigned_role text,
  role_name text,
  sector text,
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
    ec.collaborator_id,
    ec.collaborator_name,

    CASE
      WHEN c.matricula IS NULL THEN NULL
      ELSE left(c.matricula, 2) || '***' || right(c.matricula, 2)
    END,

    CASE
      WHEN c.email IS NULL THEN NULL
      ELSE left(c.email, 2) || '***@' || split_part(c.email, '@', 2)
    END,

    ec.assigned_role,
    ec.role_name,
    ec.sector,
    ec.present,
    ec.absent,
    ec.signed_at,
    ec.departed_at

  FROM public.ps_event_collaborators ec

  JOIN public.ps_events e
    ON e.id = ec.event_id

  LEFT JOIN public.ps_collaborators c
    ON c.id = ec.collaborator_id

  WHERE ec.event_id = p_event_id

    AND COALESCE(e.hidden_from_evaluation, false) = false

    -- Mantém somente a equipe operacional atual.
    -- Quem recusou ou já foi substituído permanece no histórico,
    -- mas não aparece novamente na presença/avaliação pública.
    AND ec.participation_status IN (
      'pending_confirmation',
      'confirmed'
    )

    AND (
      trim(coalesce(p_search, '')) = ''

      OR ec.collaborator_name
        ILIKE '%' || trim(p_search) || '%'

      OR c.matricula
        ILIKE '%' || trim(p_search) || '%'

      OR c.email
        ILIKE '%' || trim(p_search) || '%'

      OR ec.role_name
        ILIKE '%' || trim(p_search) || '%'

      OR ec.assigned_role
        ILIKE '%' || trim(p_search) || '%'

      OR ec.sector
        ILIKE '%' || trim(p_search) || '%'
    )

  ORDER BY ec.collaborator_name

  LIMIT 1000;
$$;

REVOKE ALL
ON FUNCTION public.ps_public_search_event_roster(uuid, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_search_event_roster(uuid, text)
TO anon, authenticated;
