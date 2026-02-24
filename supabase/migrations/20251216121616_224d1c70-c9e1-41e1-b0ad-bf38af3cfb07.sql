-- Insert permissions for the new supervisor role
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES
  -- Tasks - Supervisor can view, create, edit, approve but not delete
  ('supervisor', 'tasks', 'view', true),
  ('supervisor', 'tasks', 'create', true),
  ('supervisor', 'tasks', 'edit', true),
  ('supervisor', 'tasks', 'delete', false),
  ('supervisor', 'tasks', 'approve', true),
  -- Reservations
  ('supervisor', 'reservations', 'view', true),
  ('supervisor', 'reservations', 'create', true),
  ('supervisor', 'reservations', 'edit', true),
  ('supervisor', 'reservations', 'delete', false),
  ('supervisor', 'reservations', 'approve', true),
  -- Materials
  ('supervisor', 'materials', 'view', true),
  ('supervisor', 'materials', 'create', true),
  ('supervisor', 'materials', 'edit', true),
  ('supervisor', 'materials', 'delete', false),
  ('supervisor', 'materials', 'approve', true),
  -- Equipment
  ('supervisor', 'equipment', 'view', true),
  ('supervisor', 'equipment', 'create', true),
  ('supervisor', 'equipment', 'edit', true),
  ('supervisor', 'equipment', 'delete', false),
  -- Lockers
  ('supervisor', 'lockers', 'view', true),
  ('supervisor', 'lockers', 'create', true),
  ('supervisor', 'lockers', 'edit', true),
  ('supervisor', 'lockers', 'delete', false),
  -- Lost and Found
  ('supervisor', 'lostAndFound', 'view', true),
  ('supervisor', 'lostAndFound', 'create', true),
  ('supervisor', 'lostAndFound', 'edit', true),
  ('supervisor', 'lostAndFound', 'delete', false),
  -- Rooms (Checklist)
  ('supervisor', 'rooms', 'view', true),
  ('supervisor', 'rooms', 'create', true),
  ('supervisor', 'rooms', 'edit', true),
  ('supervisor', 'rooms', 'delete', false),
  -- Classroom Calls
  ('supervisor', 'classroomCalls', 'view', true),
  ('supervisor', 'classroomCalls', 'create', true),
  ('supervisor', 'classroomCalls', 'edit', true),
  ('supervisor', 'classroomCalls', 'delete', false),
  -- Users - Supervisor can only view
  ('supervisor', 'users', 'view', true),
  ('supervisor', 'users', 'create', false),
  ('supervisor', 'users', 'edit', false),
  ('supervisor', 'users', 'delete', false),
  -- Settings - Supervisor can view but not edit
  ('supervisor', 'settings', 'view', true),
  ('supervisor', 'settings', 'edit', false)
ON CONFLICT DO NOTHING;