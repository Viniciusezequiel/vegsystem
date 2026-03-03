
-- Add event datetime columns to tasks table for "acompanhamento" category
ALTER TABLE public.tasks ADD COLUMN event_start_datetime timestamp with time zone DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN event_end_datetime timestamp with time zone DEFAULT NULL;
