
-- Table for classroom call rooms (managed by admin)
CREATE TABLE public.classroom_call_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campus text NOT NULL DEFAULT 'Campus I',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for issues/problems linked to rooms
CREATE TABLE public.classroom_call_room_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.classroom_call_rooms(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for pre-defined response messages (used when accepting calls)
CREATE TABLE public.classroom_call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add response_message column to classroom_calls
ALTER TABLE public.classroom_calls ADD COLUMN response_message text;

-- Enable RLS
ALTER TABLE public.classroom_call_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_room_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_responses ENABLE ROW LEVEL SECURITY;

-- RLS for classroom_call_rooms
CREATE POLICY "Anyone can view active rooms" ON public.classroom_call_rooms
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage rooms" ON public.classroom_call_rooms
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- RLS for classroom_call_room_issues
CREATE POLICY "Anyone can view active issues" ON public.classroom_call_room_issues
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage issues" ON public.classroom_call_room_issues
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- RLS for classroom_call_responses
CREATE POLICY "Anyone can view active responses" ON public.classroom_call_responses
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage responses" ON public.classroom_call_responses
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_room_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_responses;
