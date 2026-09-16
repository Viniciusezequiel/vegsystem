-- Corrige cargos/funções de Setor Especial que ainda podem chegar sem role_value
-- canônico ao fluxo público de confirmação. O link já enviado permanece válido:
-- o getter público resolve os treinamentos dinamicamente a partir das atribuições.

CREATE OR REPLACE FUNCTION public.ps_resolve_role_value(p_role_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH input AS (
    SELECT trim(coalesce(p_role_name, '')) AS raw
  ), normalized AS (
    SELECT
      raw,
      trim(both '_' from regexp_replace(
        translate(
          lower(raw),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'
        ),
        '[^a-z0-9]+', '_', 'g'
      )) AS slug
    FROM input
  ), cleaned AS (
    SELECT
      raw,
      slug,
      trim(both '_' from regexp_replace(
        regexp_replace(
          regexp_replace(
            slug,
            '_(manha_tarde|manha|tarde|noite|integral)$',
            '',
            'g'
          ),
          '_(0?[0-9]{1,2})h$',
          '',
          'g'
        ),
        '_a$',
        '',
        'g'
      )) AS cleaned_slug
    FROM normalized
  ), candidate AS (
    SELECT
      raw,
      slug,
      cleaned_slug,
      CASE
        WHEN cleaned_slug IN (
          'fiscal_lider_de_sala_especial',
          'fiscal_sala_especial',
          'fiscal_de_sala_especial'
        ) THEN 'fiscal_de_sala_especial'
        WHEN cleaned_slug ~ '(^|_)(setor_especial|sala_especial)(_|$)' THEN 'fiscal_de_sala_especial'
        WHEN cleaned_slug IN ('fiscal_de_sala', 'fiscal_sala') THEN 'fiscal_sala'
        WHEN cleaned_slug IN ('subcoordenador', 'sucoordenador') THEN 'subcoordenador'
        ELSE NULL
      END AS alias_value
    FROM cleaned
  )
  SELECT r.value
  FROM public.ps_roles r
  CROSS JOIN candidate c
  WHERE
    lower(trim(r.name)) = lower(trim(c.raw))
    OR lower(trim(r.value)) = c.slug
    OR lower(trim(r.value)) = c.cleaned_slug
    OR lower(trim(r.value)) = coalesce(c.alias_value, '')
    OR trim(both '_' from regexp_replace(
      translate(
        lower(trim(r.name)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ),
      '[^a-z0-9]+', '_', 'g'
    )) = c.cleaned_slug
  ORDER BY CASE
    WHEN lower(trim(r.name)) = lower(trim(c.raw)) THEN 0
    WHEN lower(trim(r.value)) = c.slug THEN 1
    WHEN lower(trim(r.value)) = coalesce(c.alias_value, '') THEN 2
    WHEN trim(both '_' from regexp_replace(
      translate(
        lower(trim(r.name)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ),
      '[^a-z0-9]+', '_', 'g'
    )) = c.cleaned_slug THEN 3
    ELSE 4
  END,
  r."order" NULLS LAST,
  r.name
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.ps_resolve_role_value(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ps_resolve_role_value(text) TO authenticated, service_role;

-- Repara vínculos ainda sem identificador canônico. Não altera token de confirmação,
-- status pendente, histórico de comunicação nem escolhas já existentes.
UPDATE public.ps_event_collaborator_assignments a
SET
  role_value = public.ps_resolve_role_value(a.role_name),
  updated_at = now()
WHERE public.ps_resolve_role_value(a.role_name) IS NOT NULL
  AND (
    a.role_value IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.ps_roles r WHERE r.value = a.role_value
    )
  );
