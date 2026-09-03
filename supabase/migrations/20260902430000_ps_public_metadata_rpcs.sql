-- Metadados mínimos necessários às páginas públicas do Processo Seletivo.
-- Não reabre SELECT direto em ps_events ou ps_roles.

REVOKE SELECT ON public.ps_events FROM anon;
REVOKE SELECT ON public.ps_roles FROM anon;


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
      p_surface = 'attendance'

      OR (
        p_surface = 'self_evaluation'
        AND coalesce(e.self_evaluation_enabled, false) = true
        AND e.status <> 'finalizado'
      )
    )
  ORDER BY
    e.date DESC,
    e.name
  LIMIT 500;
$$;

REVOKE ALL
ON FUNCTION public.ps_public_list_events(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_list_events(text)
TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.ps_public_list_roles()
RETURNS TABLE(
  id uuid,
  name text,
  value text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.name,
    r.value,
    r."order"
  FROM public.ps_roles r
  WHERE r.active = true
  ORDER BY
    r."order",
    r.name;
$$;

REVOKE ALL
ON FUNCTION public.ps_public_list_roles()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.ps_public_list_roles()
TO anon, authenticated;
