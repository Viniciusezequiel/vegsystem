
-- Create shift handovers table
CREATE TABLE public.shift_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift TEXT NOT NULL, -- Manhã, Tarde, Noite
  day_of_week TEXT NOT NULL, -- Segunda, Terça, etc.
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sector TEXT NOT NULL DEFAULT 'Recursos Didáticos',
  unit TEXT NOT NULL DEFAULT 'FCM Unidade I',
  has_impact_incident BOOLEAN NOT NULL DEFAULT false,
  general_observations TEXT,
  collaborator_name TEXT NOT NULL,
  collaborator_time TEXT NOT NULL,
  filled_by UUID NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift handover tasks table (checklist items)
CREATE TABLE public.shift_handover_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  answer BOOLEAN NOT NULL DEFAULT false,
  observation TEXT
);

-- Create shift handover incidents table
CREATE TABLE public.shift_handover_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  description TEXT,
  location TEXT
);

-- Enable RLS
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_incidents ENABLE ROW LEVEL SECURITY;

-- Policies for shift_handovers
CREATE POLICY "Authenticated users can view shift handovers"
  ON public.shift_handovers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handovers"
  ON public.shift_handovers FOR INSERT
  WITH CHECK (auth.uid() = filled_by);

CREATE POLICY "Only admins can delete shift handovers"
  ON public.shift_handovers FOR DELETE
  USING (is_admin(auth.uid()));

-- Policies for shift_handover_tasks
CREATE POLICY "Authenticated users can view shift handover tasks"
  ON public.shift_handover_tasks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handover tasks"
  ON public.shift_handover_tasks FOR INSERT
  WITH CHECK (true);

-- Policies for shift_handover_incidents
CREATE POLICY "Authenticated users can view shift handover incidents"
  ON public.shift_handover_incidents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handover incidents"
  ON public.shift_handover_incidents FOR INSERT
  WITH CHECK (true);
