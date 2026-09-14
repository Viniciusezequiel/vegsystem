-- Corrige a resolução de cargos importados com jornada/sufixos visuais
-- (ex.: "FISCAL SANITÁRIO (08h)", "FISCAL ITINERANTE 9H",
-- "COORDENADOR(A) - MANHÃ/TARDE") para que os treinamentos por cargo
-- sejam corretamente exigidos no fluxo público de confirmação.

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

-- Repara somente atribuições ainda sem identificador de cargo válido.
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

-- Mantém o campo legado do vínculo sincronizado com a atribuição primária.
UPDATE public.ps_event_collaborators ec
SET role_value = a.role_value
FROM public.ps_event_collaborator_assignments a
WHERE a.event_collaborator_id = ec.id
  AND a.is_primary = true
  AND a.role_value IS NOT NULL
  AND (
    ec.role_value IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.ps_roles r WHERE r.value = ec.role_value
    )
  );

-- Se alguém confirmou enquanto o cargo estava sem role_value e, após a correção,
-- passa a ter treinamento obrigatório sem escolha registrada, volta apenas essa
-- confirmação para pendente. O histórico de e-mail é preservado e um novo envio
-- gera um novo token normalmente por ps_prepare_confirmation_communication().
WITH affected AS (
  SELECT DISTINCT ec.id
  FROM public.ps_event_collaborators ec
  JOIN public.ps_event_collaborator_assignments a
    ON a.event_collaborator_id = ec.id
  JOIN public.ps_event_training_group_roles tgr
    ON tgr.role_value = a.role_value
  JOIN public.ps_event_training_groups tg
    ON tg.id = tgr.training_group_id
   AND tg.event_id = ec.event_id
   AND tg.active = true
   AND tg.required = true
  WHERE ec.participation_status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.ps_event_training_choices tc
      JOIN public.ps_event_training_sessions ts
        ON ts.id = tc.training_session_id
       AND ts.active = true
      WHERE tc.event_id = ec.event_id
        AND tc.event_collaborator_id = ec.id
        AND tc.training_group_id = tg.id
        AND ts.event_id = ec.event_id
        AND ts.training_group_id = tg.id
    )
)
UPDATE public.ps_event_collaborators ec
SET
  participation_status = 'pending_confirmation',
  confirmed_at = NULL
WHERE ec.id IN (SELECT id FROM affected);
