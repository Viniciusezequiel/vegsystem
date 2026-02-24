-- Create room_combinations table to store linked rooms
CREATE TABLE public.room_combinations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    linked_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(parent_room_id, linked_room_id)
);

-- Enable RLS
ALTER TABLE public.room_combinations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view room combinations"
ON public.room_combinations
FOR SELECT
USING (true);

CREATE POLICY "Admins and collaborators can manage room combinations"
ON public.room_combinations
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Create function to get all rooms that should be blocked when a room is reserved
CREATE OR REPLACE FUNCTION public.get_linked_rooms(p_room_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result UUID[];
BEGIN
    -- Get rooms linked to this room (as parent)
    SELECT ARRAY_AGG(linked_room_id) INTO result
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    RETURN COALESCE(result, ARRAY[]::UUID[]);
END;
$$;

-- Update find_available_rooms to exclude linked rooms
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime TIMESTAMP WITH TIME ZONE, 
    p_end_datetime TIMESTAMP WITH TIME ZONE, 
    p_attendees_count INTEGER DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, code TEXT, capacity INTEGER, description TEXT, location TEXT, campus campus_enum)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
                r.room_id = rr.id
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
            )
      )
    ORDER BY rr.code;
END;
$$;

-- Update check_reservation_conflict to consider linked rooms
CREATE OR REPLACE FUNCTION public.check_reservation_conflict(
    p_room_id UUID, 
    p_start_datetime TIMESTAMP WITH TIME ZONE, 
    p_end_datetime TIMESTAMP WITH TIME ZONE, 
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
BEGIN
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
              (p_start_datetime >= start_datetime AND p_start_datetime < end_datetime)
              OR (p_end_datetime > start_datetime AND p_end_datetime <= end_datetime)
              OR (p_start_datetime <= start_datetime AND p_end_datetime >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$$;