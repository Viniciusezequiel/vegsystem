-- Regressão de busca: preservar a priorização por "terço/terco" e não misturar
-- a regra de "térmica" na lógica de matching textual.
ALTER TABLE public.lost_items
ADD COLUMN IF NOT EXISTS search_metadata text;

CREATE OR REPLACE FUNCTION public.search_lost_items_smart(
  p_search text,
  p_status text DEFAULT NULL,
  p_campus public.campus_enum DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_destination text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  code text,
  description text,
  campus public.campus_enum,
  found_location text,
  found_date date,
  received_date date,
  shelf text,
  box text,
  box_number text,
  seal_number text,
  delivered_by_name text,
  delivered_by_contact text,
  registered_by uuid,
  status text,
  owner_name text,
  owner_email text,
  owner_phone text,
  delivered_at timestamptz,
  delivered_by_team_member uuid,
  created_at timestamptz,
  updated_at timestamptz,
  search_score double precision,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
WITH input AS (
  SELECT regexp_replace(
    unaccent(lower(trim(coalesce(p_search, '')))),
    '\s+',
    ' ',
    'g'
  ) AS q
),

tokens AS (
  SELECT DISTINCT token
  FROM input i
  CROSS JOIN LATERAL
    regexp_split_to_table(i.q, '\s+') AS t(token)
  WHERE length(token) >= 2
    AND token NOT IN (
      'a', 'o', 'as', 'os',
      'de', 'da', 'do', 'das', 'dos',
      'e', 'em', 'na', 'no', 'nas', 'nos',
      'um', 'uma',
      'com', 'para'
    )
),

token_groups AS (
  SELECT
    token,
    CASE
      WHEN token IN ('caneca', 'copo', 'xicara', 'mug')
        THEN ARRAY['caneca', 'copo', 'xicara', 'mug']

      WHEN token IN ('celular', 'telefone', 'smartphone')
        THEN ARRAY['celular', 'telefone', 'smartphone']

      WHEN token IN ('fone', 'headset', 'auricular')
        THEN ARRAY['fone', 'headset', 'auricular']

      WHEN token IN ('garrafa', 'squeeze')
        THEN ARRAY['garrafa', 'squeeze']

      WHEN token IN ('carregador', 'fonte', 'charger')
        THEN ARRAY['carregador', 'fonte', 'charger']

      WHEN token IN ('mochila', 'bolsa', 'backpack')
        THEN ARRAY['mochila', 'bolsa', 'backpack']

      WHEN token IN ('carteira', 'porta-cartao', 'portacartao')
        THEN ARRAY['carteira', 'porta-cartao', 'portacartao']

      ELSE ARRAY[token]
    END AS variants
  FROM tokens
),

base AS (
  SELECT
    li.*,

    unaccent(
      lower(
        concat_ws(
          ' ',
          li.code,
          li.description,
          li.found_location,
          li.search_metadata
        )
      )
    ) AS haystack,

    unaccent(
      lower(li.description)
    ) AS description_norm

  FROM public.lost_items li

  WHERE
    (
      p_status IS NULL
      OR p_status = 'all'
      OR li.status = p_status
    )

    AND (
      p_campus IS NULL
      OR li.campus = p_campus
    )

    AND (
      p_date_from IS NULL
      OR li.received_date >= p_date_from
    )

    AND (
      p_date_to IS NULL
      OR li.received_date <= p_date_to
    )

    AND (
      p_destination IS NULL
      OR p_destination = 'all'

      OR (
        p_destination = 'donation'
        AND li.owner_name = 'DOAÇÃO'
      )

      OR (
        p_destination = 'disposal'
        AND li.owner_name = 'DESCARTE'
      )
    )
),

strong_matches AS (
  SELECT
    b.*,
    (
      CASE
        WHEN b.description_norm LIKE '%' || i.q || '%'
          THEN 100
        WHEN b.haystack LIKE '%' || i.q || '%'
          THEN 60
        ELSE 0
      END
      +
      coalesce(
        (
          SELECT sum(
            coalesce(
              (
                SELECT max(
                  CASE
                    WHEN b.haystack LIKE '%' || variant.value || '%'
                      THEN 25
                    ELSE 0
                  END
                )
                FROM unnest(g.variants) AS variant(value)
              ),
              0
            )
          )
          FROM token_groups g
        ),
        0
      )
      +
      CASE
        WHEN i.q = '' THEN 0
        ELSE greatest(
          strict_word_similarity(i.q, b.haystack),
          similarity(i.q, b.description_norm)
        ) * 30
      END
    )::double precision AS search_score

  FROM base b
  CROSS JOIN input i

  WHERE
    i.q = ''
    OR (
      EXISTS (SELECT 1 FROM token_groups)
      AND NOT EXISTS (
        SELECT 1
        FROM token_groups g
        WHERE NOT EXISTS (
          SELECT 1
          FROM unnest(g.variants) AS variant(value)
          WHERE b.haystack LIKE '%' || variant.value || '%'
        )
      )
    )
    OR (
      NOT EXISTS (SELECT 1 FROM token_groups)
      AND b.haystack LIKE '%' || i.q || '%'
    )
),

fuzzy_matches AS (
  SELECT
    b.*,
    (
      coalesce(
        (
          SELECT sum(
            coalesce(
              (
                SELECT max(
                  CASE
                    WHEN b.haystack LIKE '%' || variant.value || '%'
                      THEN 30
                    WHEN length(variant.value) >= 5
                      THEN strict_word_similarity(variant.value, b.haystack) * 25
                    ELSE 0
                  END
                )
                FROM unnest(g.variants) AS variant(value)
              ),
              0
            )
          )
          FROM token_groups g
        ),
        0
      )
      + greatest(
          strict_word_similarity(i.q, b.haystack),
          similarity(i.q, b.description_norm)
        ) * 30
    )::double precision AS search_score

  FROM base b
  CROSS JOIN input i

  WHERE
    i.q <> ''
    AND NOT EXISTS (SELECT 1 FROM strong_matches)
    AND EXISTS (SELECT 1 FROM token_groups)
    AND NOT EXISTS (
      SELECT 1
      FROM token_groups g
      WHERE NOT EXISTS (
        SELECT 1
        FROM unnest(g.variants) AS variant(value)
        WHERE
          b.haystack LIKE '%' || variant.value || '%'
          OR (
            length(variant.value) BETWEEN 5 AND 7
            AND strict_word_similarity(
              variant.value,
              b.haystack
            ) >= 0.32
          )
          OR (
            length(variant.value) >= 8
            AND strict_word_similarity(
              variant.value,
              b.haystack
            ) >= 0.42
          )
      )
    )
),

scored AS (
  SELECT * FROM strong_matches
  UNION ALL
  SELECT * FROM fuzzy_matches
)

SELECT
  s.id,
  s.code,
  s.description,
  s.campus,
  s.found_location,
  s.found_date,
  s.received_date,
  s.shelf,
  s.box,
  s.box_number,
  s.seal_number,
  s.delivered_by_name,
  s.delivered_by_contact,
  s.registered_by,
  s.status,
  s.owner_name,
  s.owner_email,
  s.owner_phone,
  s.delivered_at,
  s.delivered_by_team_member,
  s.created_at,
  s.updated_at,
  s.search_score,
  count(*) OVER() AS total_count

FROM scored s

ORDER BY
  s.search_score DESC,
  s.created_at DESC

LIMIT greatest(
  1,
  least(coalesce(p_limit, 50), 1000)
)

OFFSET greatest(
  coalesce(p_offset, 0),
  0
);
$$;

REVOKE ALL
ON FUNCTION public.search_lost_items_smart(
  text,
  text,
  public.campus_enum,
  date,
  date,
  text,
  integer,
  integer
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.search_lost_items_smart(
  text,
  text,
  public.campus_enum,
  date,
  date,
  text,
  integer,
  integer
)
TO authenticated, service_role;
