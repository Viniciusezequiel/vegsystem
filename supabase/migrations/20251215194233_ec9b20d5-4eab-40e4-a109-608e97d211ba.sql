-- Add tasks permissions to role_permissions table
INSERT INTO public.role_permissions (role, module, action, allowed)
SELECT role::app_role, 'tasks', action, 
  CASE 
    WHEN role = 'admin' THEN true
    WHEN role = 'analista' AND action IN ('view', 'create', 'edit', 'approve') THEN true
    ELSE false
  END
FROM (VALUES ('admin'), ('analista'), ('assistente')) AS roles(role)
CROSS JOIN (VALUES ('view'), ('create'), ('edit'), ('delete'), ('approve')) AS actions(action)
ON CONFLICT DO NOTHING;

-- Update material_requests policies to allow users to edit their own requests
DROP POLICY IF EXISTS "Authenticated users can create requests" ON public.material_requests;
DROP POLICY IF EXISTS "Admins and analistas can update requests" ON public.material_requests;

-- Users can create their own requests
CREATE POLICY "Users can create their own requests" ON public.material_requests
FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Users can update their own requests (but not change status to approved/delivered)
CREATE POLICY "Users can update their own requests" ON public.material_requests
FOR UPDATE USING (auth.uid() = requester_id AND status IN ('pending', 'rejected'))
WITH CHECK (auth.uid() = requester_id AND status IN ('pending', 'rejected'));

-- Admins and analistas can update any requests
CREATE POLICY "Admins and analistas can manage requests" ON public.material_requests
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));