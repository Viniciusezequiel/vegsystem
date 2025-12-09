-- Create reservation_rooms table for classroom management
CREATE TABLE public.reservation_rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    location TEXT,
    campus campus_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservations table
CREATE TABLE public.reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT,
    attendees_count INTEGER NOT NULL DEFAULT 1,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    is_external BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    approved_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservation_logs table for history
CREATE TABLE public.reservation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    room_id UUID REFERENCES public.reservation_rooms(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    performed_by UUID,
    performer_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to check for reservation conflicts
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
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE room_id = p_room_id
          AND status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (p_start_datetime >= start_datetime AND p_start_datetime < end_datetime)
              OR (p_end_datetime > start_datetime AND p_end_datetime <= end_datetime)
              OR (p_start_datetime <= start_datetime AND p_end_datetime >= end_datetime)
          )
    );
END;
$$;

-- Create function to find available rooms
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime TIMESTAMP WITH TIME ZONE,
    p_end_datetime TIMESTAMP WITH TIME ZONE,
    p_attendees_count INTEGER DEFAULT 1,
    p_campus campus_enum DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    capacity INTEGER,
    description TEXT,
    location TEXT,
    campus campus_enum
)
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
          WHERE r.room_id = rr.id
            AND r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
      )
    ORDER BY rr.code;
END;
$$;

-- Enable RLS
ALTER TABLE public.reservation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for reservation_rooms
CREATE POLICY "Anyone can view active rooms"
ON public.reservation_rooms
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can manage rooms"
ON public.reservation_rooms
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- RLS policies for reservations
CREATE POLICY "Authenticated users can view reservations"
ON public.reservations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert reservations"
ON public.reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and collaborators can update reservations"
ON public.reservations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Only admins can delete reservations"
ON public.reservations
FOR DELETE
USING (is_admin(auth.uid()));

-- RLS policies for reservation_logs
CREATE POLICY "Authenticated users can view logs"
ON public.reservation_logs
FOR SELECT
USING (true);

CREATE POLICY "System can insert logs"
ON public.reservation_logs
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_reservation_rooms_updated_at
BEFORE UPDATE ON public.reservation_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default classrooms (01 to 10)
INSERT INTO public.reservation_rooms (name, code, capacity, location, campus, description) VALUES
('Sala de Aula 01', 'SALA-01', 40, 'Bloco A - Térreo', 'Campus I', 'Sala de aula padrão com projetor'),
('Sala de Aula 02', 'SALA-02', 40, 'Bloco A - Térreo', 'Campus I', 'Sala de aula padrão com projetor'),
('Sala de Aula 03', 'SALA-03', 35, 'Bloco A - 1º Andar', 'Campus I', 'Sala de aula com ar condicionado'),
('Sala de Aula 04', 'SALA-04', 35, 'Bloco A - 1º Andar', 'Campus I', 'Sala de aula com ar condicionado'),
('Sala de Aula 05', 'SALA-05', 30, 'Bloco B - Térreo', 'Campus I', 'Sala de aula com computadores'),
('Sala de Aula 06', 'SALA-06', 30, 'Bloco B - Térreo', 'Campus I', 'Sala de aula com computadores'),
('Sala de Aula 07', 'SALA-07', 50, 'Bloco B - 1º Andar', 'Campus I', 'Auditório pequeno'),
('Sala de Aula 08', 'SALA-08', 25, 'Bloco C - Térreo', 'Campus I', 'Sala de reuniões'),
('Sala de Aula 09', 'SALA-09', 20, 'Bloco C - Térreo', 'Campus I', 'Laboratório de práticas'),
('Sala de Aula 10', 'SALA-10', 45, 'Bloco C - 1º Andar', 'Campus I', 'Sala multiuso');