-- Create permissions table for granular role-based access control
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role app_role NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(role, module, action)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage permissions"
ON public.role_permissions
FOR ALL
USING (is_admin(auth.uid()));

-- All authenticated users can view permissions (to check their own access)
CREATE POLICY "Authenticated users can view permissions"
ON public.role_permissions
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create function to check if a role has permission for a specific action
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rp.allowed
     FROM public.role_permissions rp
     INNER JOIN public.user_roles ur ON ur.role = rp.role
     WHERE ur.user_id = _user_id
       AND rp.module = _module
       AND rp.action = _action
     LIMIT 1),
    -- Default: admin has all permissions, others depend on action type
    CASE 
      WHEN is_admin(_user_id) THEN true
      ELSE false
    END
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default permissions for all roles
-- Modules: lostAndFound, equipment, reservations, lockers, rooms, materials, users, settings
-- Actions: view, create, edit, delete, approve

-- Admin - full access
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
('admin', 'lostAndFound', 'view', true),
('admin', 'lostAndFound', 'create', true),
('admin', 'lostAndFound', 'edit', true),
('admin', 'lostAndFound', 'delete', true),
('admin', 'equipment', 'view', true),
('admin', 'equipment', 'create', true),
('admin', 'equipment', 'edit', true),
('admin', 'equipment', 'delete', true),
('admin', 'reservations', 'view', true),
('admin', 'reservations', 'create', true),
('admin', 'reservations', 'edit', true),
('admin', 'reservations', 'delete', true),
('admin', 'reservations', 'approve', true),
('admin', 'lockers', 'view', true),
('admin', 'lockers', 'create', true),
('admin', 'lockers', 'edit', true),
('admin', 'lockers', 'delete', true),
('admin', 'rooms', 'view', true),
('admin', 'rooms', 'create', true),
('admin', 'rooms', 'edit', true),
('admin', 'rooms', 'delete', true),
('admin', 'materials', 'view', true),
('admin', 'materials', 'create', true),
('admin', 'materials', 'edit', true),
('admin', 'materials', 'delete', true),
('admin', 'materials', 'approve', true),
('admin', 'users', 'view', true),
('admin', 'users', 'create', true),
('admin', 'users', 'edit', true),
('admin', 'users', 'delete', true),
('admin', 'settings', 'view', true),
('admin', 'settings', 'edit', true),
('admin', 'classroomCalls', 'view', true),
('admin', 'classroomCalls', 'create', true),
('admin', 'classroomCalls', 'edit', true),
('admin', 'classroomCalls', 'delete', true);

-- Analista - can view, create, edit most things, no delete, can approve
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
('analista', 'lostAndFound', 'view', true),
('analista', 'lostAndFound', 'create', true),
('analista', 'lostAndFound', 'edit', true),
('analista', 'lostAndFound', 'delete', false),
('analista', 'equipment', 'view', true),
('analista', 'equipment', 'create', true),
('analista', 'equipment', 'edit', true),
('analista', 'equipment', 'delete', false),
('analista', 'reservations', 'view', true),
('analista', 'reservations', 'create', true),
('analista', 'reservations', 'edit', true),
('analista', 'reservations', 'delete', false),
('analista', 'reservations', 'approve', true),
('analista', 'lockers', 'view', true),
('analista', 'lockers', 'create', true),
('analista', 'lockers', 'edit', true),
('analista', 'lockers', 'delete', false),
('analista', 'rooms', 'view', true),
('analista', 'rooms', 'create', true),
('analista', 'rooms', 'edit', true),
('analista', 'rooms', 'delete', false),
('analista', 'materials', 'view', true),
('analista', 'materials', 'create', true),
('analista', 'materials', 'edit', true),
('analista', 'materials', 'delete', false),
('analista', 'materials', 'approve', true),
('analista', 'users', 'view', true),
('analista', 'users', 'create', false),
('analista', 'users', 'edit', false),
('analista', 'users', 'delete', false),
('analista', 'settings', 'view', true),
('analista', 'settings', 'edit', false),
('analista', 'classroomCalls', 'view', true),
('analista', 'classroomCalls', 'create', true),
('analista', 'classroomCalls', 'edit', true),
('analista', 'classroomCalls', 'delete', false);

-- Assistente - limited access, mostly view and create
INSERT INTO public.role_permissions (role, module, action, allowed) VALUES
('assistente', 'lostAndFound', 'view', true),
('assistente', 'lostAndFound', 'create', true),
('assistente', 'lostAndFound', 'edit', false),
('assistente', 'lostAndFound', 'delete', false),
('assistente', 'equipment', 'view', true),
('assistente', 'equipment', 'create', false),
('assistente', 'equipment', 'edit', false),
('assistente', 'equipment', 'delete', false),
('assistente', 'reservations', 'view', true),
('assistente', 'reservations', 'create', true),
('assistente', 'reservations', 'edit', true),
('assistente', 'reservations', 'delete', false),
('assistente', 'reservations', 'approve', false),
('assistente', 'lockers', 'view', true),
('assistente', 'lockers', 'create', false),
('assistente', 'lockers', 'edit', false),
('assistente', 'lockers', 'delete', false),
('assistente', 'rooms', 'view', true),
('assistente', 'rooms', 'create', false),
('assistente', 'rooms', 'edit', false),
('assistente', 'rooms', 'delete', false),
('assistente', 'materials', 'view', true),
('assistente', 'materials', 'create', true),
('assistente', 'materials', 'edit', false),
('assistente', 'materials', 'delete', false),
('assistente', 'materials', 'approve', false),
('assistente', 'users', 'view', false),
('assistente', 'users', 'create', false),
('assistente', 'users', 'edit', false),
('assistente', 'users', 'delete', false),
('assistente', 'settings', 'view', false),
('assistente', 'settings', 'edit', false),
('assistente', 'classroomCalls', 'view', true),
('assistente', 'classroomCalls', 'create', true),
('assistente', 'classroomCalls', 'edit', true),
('assistente', 'classroomCalls', 'delete', false);