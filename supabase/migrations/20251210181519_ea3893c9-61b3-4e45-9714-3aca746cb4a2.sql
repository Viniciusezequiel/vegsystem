-- Create classroom calls table for teacher requests
CREATE TABLE public.classroom_calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    accepted_by UUID REFERENCES auth.users(id),
    accepted_by_name TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.classroom_calls ENABLE ROW LEVEL SECURITY;

-- Anyone can create calls (public access for teachers)
CREATE POLICY "Anyone can create classroom calls" 
ON public.classroom_calls 
FOR INSERT 
WITH CHECK (true);

-- Admins and collaborators can view all calls
CREATE POLICY "Admins and collaborators can view classroom calls" 
ON public.classroom_calls 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- Admins and collaborators can update calls (accept/resolve)
CREATE POLICY "Admins and collaborators can update classroom calls" 
ON public.classroom_calls 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- Only admins can delete calls
CREATE POLICY "Only admins can delete classroom calls" 
ON public.classroom_calls 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_calls;