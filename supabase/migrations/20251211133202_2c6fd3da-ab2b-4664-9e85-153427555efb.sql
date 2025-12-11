
-- Update check_reservation_conflict to add 15 min buffer for external reservations
CREATE OR REPLACE FUNCTION public.check_reservation_conflict(
    p_room_id uuid, 
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_exclude_reservation_id uuid DEFAULT NULL::uuid,
    p_is_external boolean DEFAULT false
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

    -- Get rooms linked to this room
    SELECT ARRAY_AGG(linked_room_id) INTO linked_rooms
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    -- Get parent rooms that link to this room
    SELECT ARRAY_AGG(parent_room_id) INTO parent_rooms
    FROM public.room_combinations
    WHERE linked_room_id = p_room_id;
    
    linked_rooms := COALESCE(linked_rooms, ARRAY[]::UUID[]);
    parent_rooms := COALESCE(parent_rooms, ARRAY[]::UUID[]);

    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (check_start >= start_datetime AND check_start < end_datetime)
              OR (check_end > start_datetime AND check_end <= end_datetime)
              OR (check_start <= start_datetime AND check_end >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$function$;

-- Update find_available_rooms to add 15 min buffer for external use
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_attendees_count integer DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL::campus_enum,
    p_is_external boolean DEFAULT false
)
 RETURNS TABLE(id uuid, name text, code text, capacity integer, description text, location text, campus campus_enum)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

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
                (check_start >= r.start_datetime AND check_start < r.end_datetime)
                OR (check_end > r.start_datetime AND check_end <= r.end_datetime)
                OR (check_start <= r.start_datetime AND check_end >= r.end_datetime)
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
