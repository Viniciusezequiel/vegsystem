
-- Allow anonymous users to view reservations (for public board)
CREATE POLICY "Anyone can view reservations publicly"
ON public.reservations FOR SELECT
TO anon
USING (status IN ('pending', 'confirmed'));

-- Allow anonymous users to view reservation rooms (for public board)
CREATE POLICY "Anyone can view active reservation rooms"
ON public.reservation_rooms FOR SELECT
TO anon
USING (is_active = true);
