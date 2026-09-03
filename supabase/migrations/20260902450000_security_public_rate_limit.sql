-- Rate limiting persistente para endpoints públicos.
-- Não armazena IP puro: somente SHA-256 gerado pela Edge Function.

CREATE TABLE IF NOT EXISTS public.public_api_rate_limits (
  endpoint text NOT NULL,
  client_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (endpoint, client_hash)
);

ALTER TABLE public.public_api_rate_limits
ENABLE ROW LEVEL SECURITY;

REVOKE ALL
ON TABLE public.public_api_rate_limits
FROM PUBLIC, anon, authenticated;

GRANT ALL
ON TABLE public.public_api_rate_limits
TO service_role;


CREATE OR REPLACE FUNCTION public.consume_public_api_rate_limit(
  p_endpoint text,
  p_client_hash text,
  p_limit integer DEFAULT 10,
  p_window_seconds integer DEFAULT 60
)
RETURNS TABLE(
  allowed boolean,
  retry_after integer,
  current_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.public_api_rate_limits%ROWTYPE;
  v_now timestamptz := now();
  v_elapsed numeric;
BEGIN
  IF
    nullif(trim(coalesce(p_endpoint, '')), '') IS NULL
    OR nullif(trim(coalesce(p_client_hash, '')), '') IS NULL
    OR p_limit < 1
    OR p_limit > 1000
    OR p_window_seconds < 1
    OR p_window_seconds > 86400
  THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  INSERT INTO public.public_api_rate_limits (
    endpoint,
    client_hash,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (
    left(trim(p_endpoint), 100),
    left(trim(p_client_hash), 128),
    v_now,
    0,
    v_now
  )
  ON CONFLICT (endpoint, client_hash)
  DO NOTHING;

  SELECT *
  INTO v_row
  FROM public.public_api_rate_limits
  WHERE endpoint = left(trim(p_endpoint), 100)
    AND client_hash = left(trim(p_client_hash), 128)
  FOR UPDATE;

  v_elapsed :=
    extract(epoch FROM (v_now - v_row.window_started_at));

  IF v_elapsed >= p_window_seconds THEN
    UPDATE public.public_api_rate_limits
    SET
      window_started_at = v_now,
      request_count = 1,
      updated_at = v_now
    WHERE endpoint = v_row.endpoint
      AND client_hash = v_row.client_hash;

    RETURN QUERY
    SELECT true, 0, 1;

    RETURN;
  END IF;

  IF v_row.request_count >= p_limit THEN
    RETURN QUERY
    SELECT
      false,
      greatest(
        1,
        ceil(
          p_window_seconds - v_elapsed
        )::integer
      ),
      v_row.request_count;

    RETURN;
  END IF;

  UPDATE public.public_api_rate_limits
  SET
    request_count = request_count + 1,
    updated_at = v_now
  WHERE endpoint = v_row.endpoint
    AND client_hash = v_row.client_hash
  RETURNING request_count
  INTO v_row.request_count;

  RETURN QUERY
  SELECT true, 0, v_row.request_count;
END;
$$;


REVOKE ALL
ON FUNCTION public.consume_public_api_rate_limit(
  text,
  text,
  integer,
  integer
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.consume_public_api_rate_limit(
  text,
  text,
  integer,
  integer
)
TO service_role;


-- Higiene: evita crescimento indefinido.
CREATE INDEX IF NOT EXISTS
public_api_rate_limits_updated_idx
ON public.public_api_rate_limits(updated_at);
