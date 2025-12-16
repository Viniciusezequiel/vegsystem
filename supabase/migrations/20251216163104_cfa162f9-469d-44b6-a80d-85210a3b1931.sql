-- Add activityHistory permissions for all roles
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
-- Admin permissions (automatically has all, but adding for completeness)
('admin', 'activityHistory', 'view', true),
-- Supervisor permissions
('supervisor', 'activityHistory', 'view', true),
-- Analista permissions  
('analista', 'activityHistory', 'view', true),
-- Assistente permissions (can view activity history)
('assistente', 'activityHistory', 'view', true)
ON CONFLICT DO NOTHING;