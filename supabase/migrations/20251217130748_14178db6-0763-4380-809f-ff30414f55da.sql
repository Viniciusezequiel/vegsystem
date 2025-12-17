-- ============================================
-- COMPREHENSIVE RLS POLICY REVIEW AND FIX
-- ============================================

-- 1. CLASSROOM_CALLS - Add supervisor to SELECT and UPDATE
DROP POLICY IF EXISTS "Internal users can view classroom calls" ON classroom_calls;
DROP POLICY IF EXISTS "Internal users can update classroom calls" ON classroom_calls;

CREATE POLICY "Internal users can view classroom calls" 
ON classroom_calls FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update classroom calls" 
ON classroom_calls FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 2. ACTIVITY_LOGS - Add assistente to view (they should see activity)
DROP POLICY IF EXISTS "Internal users can view activity logs" ON activity_logs;

CREATE POLICY "Internal users can view activity logs" 
ON activity_logs FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 3. INVENTORY_MOVEMENTS - Add supervisor to view
DROP POLICY IF EXISTS "Internal users can view inventory movements" ON inventory_movements;

CREATE POLICY "Internal users can view inventory movements" 
ON inventory_movements FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 4. PROFILES - Ensure all internal users can view profiles
DROP POLICY IF EXISTS "Internal users can view all profiles" ON profiles;

CREATE POLICY "Internal users can view all profiles" 
ON profiles FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 5. EXTERNAL_USERS - Add supervisor to view
DROP POLICY IF EXISTS "Internal users can view all external users" ON external_users;

CREATE POLICY "Internal users can view all external users" 
ON external_users FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 6. RESERVATION_LOGS - Add supervisor to view
DROP POLICY IF EXISTS "Internal users can view logs" ON reservation_logs;

CREATE POLICY "Internal users can view logs" 
ON reservation_logs FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 7. RESERVATIONS - Add supervisor to update
DROP POLICY IF EXISTS "Internal users can update reservations" ON reservations;

CREATE POLICY "Internal users can update reservations" 
ON reservations FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- 8. EXTERNAL_EQUIPMENT_REQUESTS - Add supervisor and assistente to view/update
DROP POLICY IF EXISTS "Admins and analistas can view external requests" ON external_equipment_requests;
DROP POLICY IF EXISTS "Admins and analistas can update external requests" ON external_equipment_requests;

CREATE POLICY "Internal users can view external requests" 
ON external_equipment_requests FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update external requests" 
ON external_equipment_requests FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);