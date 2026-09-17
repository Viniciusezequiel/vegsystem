REVOKE ALL ON FUNCTION public.ps_normalize_event_location(text, boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.ps_admin_close_attendance_building(
  uuid, text, text, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ps_admin_close_attendance_building(
  uuid, text, text, uuid, text
) TO authenticated;
