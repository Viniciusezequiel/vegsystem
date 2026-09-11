-- Explicit Data API grants for the structured Processo Seletivo location tables.
-- The project uses default-deny privileges, so RLS policies alone are not enough.

REVOKE ALL ON TABLE public.ps_locations FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ps_location_buildings FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ps_location_rooms FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ps_event_locations FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ps_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ps_location_buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ps_location_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ps_event_locations TO authenticated;

GRANT ALL ON TABLE public.ps_locations TO service_role;
GRANT ALL ON TABLE public.ps_location_buildings TO service_role;
GRANT ALL ON TABLE public.ps_location_rooms TO service_role;
GRANT ALL ON TABLE public.ps_event_locations TO service_role;
