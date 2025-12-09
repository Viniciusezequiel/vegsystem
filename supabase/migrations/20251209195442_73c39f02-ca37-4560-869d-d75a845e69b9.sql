-- Add auto_confirm column to reservation_rooms table
-- When true, reservations for this room are automatically confirmed
-- When false, reservations need manual confirmation from collaborators
ALTER TABLE public.reservation_rooms 
ADD COLUMN auto_confirm boolean NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.reservation_rooms.auto_confirm IS 'When true, reservations are automatically confirmed. When false, they require manual confirmation from collaborators.';

-- Update find_available_rooms function to also check if parent rooms are blocked
-- when a linked room is reserved
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_attendees_count integer DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL::campus_enum
)
RETURNS TABLE(
    id uuid, 
    name text, 
    code text, 
    capacity integer, 
    description text, 
    location text, 
    campus campus_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
            AND (
                -- Direct reservation on this room
                r.room_id = rr.id
                -- Reservation on a linked room (this room is parent)
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                -- Reservation on a parent room (this room is linked)
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
                -- NEW: This room is a parent and one of its linked rooms has a reservation
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id AND rc.linked_room_id = r.room_id
                )
                -- NEW: This room is a parent and one of its linked rooms is blocked by another parent
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id 
                    AND rc.linked_room_id = ANY(get_linked_rooms(r.room_id))
                )
            )
      )
    ORDER BY rr.code;
END;
$function$;