-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE IF EXISTS public.external_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

-- External users: allow users to read/maintain their own external profile
DROP POLICY IF EXISTS "External users can view own record" ON public.external_users;
CREATE POLICY "External users can view own record"
ON public.external_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "External users can insert own record" ON public.external_users;
CREATE POLICY "External users can insert own record"
ON public.external_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "External users can update own record" ON public.external_users;
CREATE POLICY "External users can update own record"
ON public.external_users
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Roles: allow authenticated users to read their own role (needed for routing)
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
