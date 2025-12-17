-- Add approve action for equipment module (for loan approvals)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES 
  ('admin', 'equipment', 'approve', true),
  ('supervisor', 'equipment', 'approve', true),
  ('analista', 'equipment', 'approve', true),
  ('assistente', 'equipment', 'approve', false)
ON CONFLICT DO NOTHING;

-- Add approve action for lockers module (for locker loan approvals)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES 
  ('admin', 'lockers', 'approve', true),
  ('supervisor', 'lockers', 'approve', true),
  ('analista', 'lockers', 'approve', true),
  ('assistente', 'lockers', 'approve', false)
ON CONFLICT DO NOTHING;

-- Add approve action for classroomCalls module (for call validation)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES 
  ('admin', 'classroomCalls', 'approve', true),
  ('supervisor', 'classroomCalls', 'approve', true),
  ('analista', 'classroomCalls', 'approve', true),
  ('assistente', 'classroomCalls', 'approve', false)
ON CONFLICT DO NOTHING;

-- Add approve action for lostAndFound module (for item delivery approval)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES 
  ('admin', 'lostAndFound', 'approve', true),
  ('supervisor', 'lostAndFound', 'approve', true),
  ('analista', 'lostAndFound', 'approve', true),
  ('assistente', 'lostAndFound', 'approve', false)
ON CONFLICT DO NOTHING;

-- Add approve action for rooms module (if needed for checklist approval)
INSERT INTO public.role_permissions (role, module, action, allowed)
VALUES 
  ('admin', 'rooms', 'approve', true),
  ('supervisor', 'rooms', 'approve', true),
  ('analista', 'rooms', 'approve', true),
  ('assistente', 'rooms', 'approve', false)
ON CONFLICT DO NOTHING;