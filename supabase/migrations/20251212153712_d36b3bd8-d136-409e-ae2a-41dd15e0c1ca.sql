-- Drop the temporary enum that was created
DROP TYPE IF EXISTS public.app_role_new;

-- Step 1: Drop all RLS policies that reference app_role
DROP POLICY IF EXISTS "Admins and collaborators can insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admins and collaborators can update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Admins and collaborators can insert equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and collaborators can update equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and collaborators can view equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and collaborators can insert lockers" ON public.lockers;
DROP POLICY IF EXISTS "Admins and collaborators can update lockers" ON public.lockers;
DROP POLICY IF EXISTS "Admins and collaborators can insert locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and collaborators can update locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and collaborators can view locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and collaborators can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admins and collaborators can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.reservation_rooms;
DROP POLICY IF EXISTS "Admins and collaborators can manage rooms" ON public.reservation_rooms;
DROP POLICY IF EXISTS "Admins and collaborators can update reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins and collaborators can insert lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Admins and collaborators can update lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Admins and collaborators can manage room combinations" ON public.room_combinations;
DROP POLICY IF EXISTS "Users can view their own requests" ON public.material_requests;
DROP POLICY IF EXISTS "Admins and collaborators can update requests" ON public.material_requests;
DROP POLICY IF EXISTS "Admins and collaborators can update external requests" ON public.external_equipment_requests;
DROP POLICY IF EXISTS "Admins and collaborators can view external requests" ON public.external_equipment_requests;
DROP POLICY IF EXISTS "Admins and collaborators can insert reschedulings" ON public.reservation_reschedulings;
DROP POLICY IF EXISTS "Admins and collaborators can update reschedulings" ON public.reservation_reschedulings;
DROP POLICY IF EXISTS "Admins and collaborators can view logs" ON public.reservation_logs;
DROP POLICY IF EXISTS "Admins and collaborators can view classroom calls" ON public.classroom_calls;
DROP POLICY IF EXISTS "Admins and collaborators can update classroom calls" ON public.classroom_calls;
DROP POLICY IF EXISTS "Admins and collaborators can view all external users" ON public.external_users;
DROP POLICY IF EXISTS "Admins and collaborators can update external users" ON public.external_users;
DROP POLICY IF EXISTS "Admins and collaborators can delete external users" ON public.external_users;
DROP POLICY IF EXISTS "Admins and collaborators can insert external users" ON public.external_users;

-- Step 2: Drop the has_role function
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Step 3: Update the user_roles table temporarily to text
ALTER TABLE public.user_roles 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE text;

-- Step 4: Update existing role values
UPDATE public.user_roles SET role = 'analista' WHERE role = 'collaborator';
UPDATE public.user_roles SET role = 'assistente' WHERE role = 'viewer';

-- Step 5: Drop old enum and create new one
DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'analista', 'assistente');

-- Step 6: Convert column back to enum
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.app_role USING role::public.app_role,
  ALTER COLUMN role SET DEFAULT 'assistente'::public.app_role;

-- Step 7: Recreate has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 8: Create helper functions for new role structure
CREATE OR REPLACE FUNCTION public.is_admin_or_analista(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'analista')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Step 9: Recreate all RLS policies with new role names

-- Equipment policies
CREATE POLICY "Admins and analistas can insert equipment" ON public.equipment
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update equipment" ON public.equipment
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Equipment loans policies
CREATE POLICY "Admins and analistas can insert equipment loans" ON public.equipment_loans
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update equipment loans" ON public.equipment_loans
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can view equipment loans" ON public.equipment_loans
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Lockers policies
CREATE POLICY "Admins and analistas can insert lockers" ON public.lockers
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update lockers" ON public.lockers
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Locker loans policies
CREATE POLICY "Admins and analistas can insert locker loans" ON public.locker_loans
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update locker loans" ON public.locker_loans
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can view locker loans" ON public.locker_loans
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Rooms policies
CREATE POLICY "Admins and analistas can insert rooms" ON public.rooms
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update rooms" ON public.rooms
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Reservation rooms policies
CREATE POLICY "Anyone can view active rooms" ON public.reservation_rooms
FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can manage rooms" ON public.reservation_rooms
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Reservations policies (assistentes can only create/view, analistas can edit)
CREATE POLICY "Internal users can update reservations" ON public.reservations
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

-- Lost items policies
CREATE POLICY "Internal users can insert lost items" ON public.lost_items
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

CREATE POLICY "Admins and analistas can update lost items" ON public.lost_items
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Room combinations policies
CREATE POLICY "Admins and analistas can manage room combinations" ON public.room_combinations
FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Material requests policies
CREATE POLICY "Users can view their own requests" ON public.material_requests
FOR SELECT USING (auth.uid() = requester_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update requests" ON public.material_requests
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- External equipment requests policies
CREATE POLICY "Admins and analistas can update external requests" ON public.external_equipment_requests
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can view external requests" ON public.external_equipment_requests
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Reschedulings policies
CREATE POLICY "Admins and analistas can insert reschedulings" ON public.reservation_reschedulings
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can update reschedulings" ON public.reservation_reschedulings
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

-- Reservation logs policies
CREATE POLICY "Internal users can view logs" ON public.reservation_logs
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

-- Classroom calls policies
CREATE POLICY "Internal users can view classroom calls" ON public.classroom_calls
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

CREATE POLICY "Internal users can update classroom calls" ON public.classroom_calls
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

-- External users policies
CREATE POLICY "Internal users can view all external users" ON public.external_users
FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista') OR has_role(auth.uid(), 'assistente'));

CREATE POLICY "Admins and analistas can update external users" ON public.external_users
FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can delete external users" ON public.external_users
FOR DELETE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));

CREATE POLICY "Admins and analistas can insert external users" ON public.external_users
FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analista'));