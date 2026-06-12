
-- 1. activity_logs: INSERT policy already exists (auth.uid() IS NOT NULL). Tighten to internal roles for cleanliness.
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Internal users can insert activity logs"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role) OR
  public.has_role(auth.uid(),'analista'::app_role) OR
  public.has_role(auth.uid(),'assistente'::app_role) OR
  public.has_role(auth.uid(),'supervisor'::app_role) OR
  public.has_role(auth.uid(),'visualizador'::app_role) OR
  public.has_role(auth.uid(),'atendente'::app_role)
);

-- 2. reservation_reschedulings: restrict SELECT to authenticated only (was "true" for public role)
DROP POLICY IF EXISTS "Authenticated users can view reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Authenticated users can view reschedulings"
ON public.reservation_reschedulings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. reservations: remove PII exposure to anon. Drop anon SELECT policy, create a SECURITY DEFINER RPC
--    that returns only non-PII fields for the public board.
DROP POLICY IF EXISTS "Anyone can view reservations publicly" ON public.reservations;

CREATE OR REPLACE FUNCTION public.get_public_reservations(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  id uuid,
  title text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  status text,
  attendees_count integer,
  room_id uuid,
  description text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, start_datetime, end_datetime, status, attendees_count, room_id, description, notes
  FROM public.reservations
  WHERE status IN ('pending','confirmed')
    AND start_datetime >= p_start
    AND start_datetime <= p_end;
$$;

REVOKE ALL ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) TO anon, authenticated;

-- 4. Storage: lost-items DELETE/UPDATE restricted to internal roles
DROP POLICY IF EXISTS "Authenticated users can delete lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lost item images" ON storage.objects;

CREATE POLICY "Internal users can delete lost item images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lost-items' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

CREATE POLICY "Internal users can update lost item images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lost-items' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

-- 5. Storage: task-attachments DELETE restricted to internal roles
DROP POLICY IF EXISTS "Users can delete task attachments" ON storage.objects;
CREATE POLICY "Internal users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

-- 6. Revoke EXECUTE from anon on SECURITY DEFINER functions that should not be publicly callable.
--    RLS helpers (has_role, is_admin, has_permission, is_admin_or_analista, is_internal_user) remain
--    executable since they are used inside policies and need to be evaluable.
REVOKE EXECUTE ON FUNCTION public.expire_old_lost_items() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_task_creator_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM anon;
