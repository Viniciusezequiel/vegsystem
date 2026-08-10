CREATE OR REPLACE FUNCTION public.create_public_uber_request(
  p_requester_name text,
  p_origin text,
  p_destination text,
  p_trip_date date,
  p_trip_time time,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  IF coalesce(trim(p_requester_name),'') = '' OR coalesce(trim(p_origin),'') = ''
     OR coalesce(trim(p_destination),'') = '' OR coalesce(trim(p_reason),'') = ''
     OR p_trip_date IS NULL OR p_trip_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios';
  END IF;

  v_code := 'UBR-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5));

  RETURN QUERY
  INSERT INTO public.uber_requests (
    code, requester_name, origin, destination, trip_date, trip_time, reason, notes, status
  ) VALUES (
    v_code,
    left(trim(p_requester_name), 200),
    left(trim(p_origin), 300),
    left(trim(p_destination), 300),
    p_trip_date,
    p_trip_time,
    left(trim(p_reason), 1000),
    left(NULLIF(trim(coalesce(p_notes,'')),''), 1000),
    'registrada'
  )
  RETURNING uber_requests.id, uber_requests.code, uber_requests.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_uber_request(text, text, text, date, time, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(text, text, text, date, time, text, text) TO anon, authenticated;