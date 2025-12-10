-- Create table for reservation reschedulings
CREATE TABLE public.reservation_reschedulings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    original_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id),
    new_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id),
    original_start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    original_end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    new_start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    new_end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    rescheduled_by UUID REFERENCES auth.users(id),
    rescheduled_by_name TEXT,
    is_recurring_update BOOLEAN NOT NULL DEFAULT false,
    affected_reservations_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.reservation_reschedulings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view reschedulings" 
ON public.reservation_reschedulings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and collaborators can insert reschedulings" 
ON public.reservation_reschedulings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can update reschedulings" 
ON public.reservation_reschedulings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Only admins can delete reschedulings" 
ON public.reservation_reschedulings 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_reschedulings_reservation_id ON public.reservation_reschedulings(reservation_id);
CREATE INDEX idx_reschedulings_created_at ON public.reservation_reschedulings(created_at DESC);
CREATE INDEX idx_reschedulings_new_start_datetime ON public.reservation_reschedulings(new_start_datetime);

-- Enable realtime for reschedulings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_reschedulings;