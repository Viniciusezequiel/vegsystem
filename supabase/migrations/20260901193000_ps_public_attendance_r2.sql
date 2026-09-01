CREATE OR REPLACE FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_signature IS NULL OR p_signature !~ '^r2/signatures/process-selection/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f-]{36}-[0-9a-f]{16}\.png$' THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  UPDATE public.ps_event_collaborators ec
  SET signature_url = p_signature, signed_at = now(), present = true, absent = false
  WHERE ec.id = p_link_id
    AND ec.signed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.ps_events e
      WHERE e.id = ec.event_id AND COALESCE(e.hidden_from_evaluation, false) = false
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro não encontrado ou já assinado'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ps_public_sign_attendance(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_public_sign_attendance(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.ps_public_sign_attendance(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO service_role;
