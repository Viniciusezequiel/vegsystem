
REVOKE ALL ON FUNCTION public.ps_public_sign_attendance(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated, service_role;
