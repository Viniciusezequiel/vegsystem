
-- Seed default permissions for atendente role
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
  ('atendente', 'lostAndFound', 'view', false),
  ('atendente', 'lostAndFound', 'create', false),
  ('atendente', 'lostAndFound', 'edit', false),
  ('atendente', 'lostAndFound', 'delete', false),
  ('atendente', 'equipment', 'view', false),
  ('atendente', 'equipment', 'create', false),
  ('atendente', 'equipment', 'edit', false),
  ('atendente', 'equipment', 'delete', false),
  ('atendente', 'reservations', 'view', false),
  ('atendente', 'reservations', 'create', false),
  ('atendente', 'reservations', 'edit', false),
  ('atendente', 'reservations', 'delete', false),
  ('atendente', 'lockers', 'view', false),
  ('atendente', 'lockers', 'create', false),
  ('atendente', 'lockers', 'edit', false),
  ('atendente', 'lockers', 'delete', false),
  ('atendente', 'rooms', 'view', false),
  ('atendente', 'rooms', 'create', false),
  ('atendente', 'rooms', 'edit', false),
  ('atendente', 'rooms', 'delete', false),
  ('atendente', 'materials', 'view', false),
  ('atendente', 'materials', 'create', false),
  ('atendente', 'materials', 'edit', false),
  ('atendente', 'materials', 'delete', false),
  ('atendente', 'users', 'view', false),
  ('atendente', 'users', 'create', false),
  ('atendente', 'users', 'edit', false),
  ('atendente', 'users', 'delete', false),
  ('atendente', 'settings', 'view', false),
  ('atendente', 'settings', 'create', false),
  ('atendente', 'settings', 'edit', false),
  ('atendente', 'settings', 'delete', false),
  ('atendente', 'classroomCalls', 'view', true),
  ('atendente', 'classroomCalls', 'create', true),
  ('atendente', 'classroomCalls', 'edit', true),
  ('atendente', 'classroomCalls', 'delete', false),
  ('atendente', 'tasks', 'view', false),
  ('atendente', 'tasks', 'create', false),
  ('atendente', 'tasks', 'edit', false),
  ('atendente', 'tasks', 'delete', false),
  ('atendente', 'activityHistory', 'view', false),
  ('atendente', 'activityHistory', 'create', false),
  ('atendente', 'activityHistory', 'edit', false),
  ('atendente', 'activityHistory', 'delete', false)
ON CONFLICT DO NOTHING;

-- Update RLS policies for classroom_calls to include atendente
DROP POLICY IF EXISTS "Internal users can view classroom calls" ON public.classroom_calls;
CREATE POLICY "Internal users can view classroom calls" ON public.classroom_calls
  FOR SELECT TO public
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'assistente'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'atendente'::app_role)
  );

DROP POLICY IF EXISTS "Internal users can update classroom calls" ON public.classroom_calls;
CREATE POLICY "Internal users can update classroom calls" ON public.classroom_calls
  FOR UPDATE TO public
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'assistente'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role) OR
    has_role(auth.uid(), 'atendente'::app_role)
  );
