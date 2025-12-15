-- Add tasks to role_permissions with proper type casting
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT role::app_role, 'tasks', action, 
    CASE WHEN role = 'admin' THEN true
         WHEN role = 'analista' AND action IN ('view', 'create', 'edit') THEN true
         WHEN role = 'assistente' AND action = 'view' THEN true
         ELSE false
    END
FROM (VALUES ('admin'), ('analista'), ('assistente')) AS roles(role)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete'), ('approve')) AS actions(action)
ON CONFLICT DO NOTHING;