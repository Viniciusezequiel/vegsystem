REVOKE ALL ON FUNCTION public.expire_old_lost_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_lost_items() TO service_role;