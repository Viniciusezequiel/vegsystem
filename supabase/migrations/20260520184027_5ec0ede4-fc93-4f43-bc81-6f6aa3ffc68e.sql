ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS recurrence_days text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_last_run_date date DEFAULT NULL;