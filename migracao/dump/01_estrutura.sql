-- ============================================================
-- VEG System - Estrutura completa do banco (schema public)
-- Gerado a partir do histórico de 128 migrações do projeto de origem.
-- Aplique este arquivo no projeto DESTINO pelo SQL Editor.
-- Contém: enums, tabelas, funções, triggers, RLS, policies e GRANTs.
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 20251205133941_65cb264a-8b75-41be-baa8-22d7fd9e6db8.sql
-- ------------------------------------------------------------
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'collaborator', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20251209115158_6c6dba11-2c7f-4a93-9764-91985cd07d7f.sql
-- ------------------------------------------------------------
-- Criar enum de campus (se não existir)
DO $$ BEGIN
  CREATE TYPE campus_enum AS ENUM ('Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum de status de equipamento
DO $$ BEGIN
  CREATE TYPE equipment_status AS ENUM ('available', 'borrowed', 'maintenance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum de status de empréstimo
DO $$ BEGIN
  CREATE TYPE loan_status AS ENUM ('active', 'returned', 'overdue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum de status de escaninho
DO $$ BEGIN
  CREATE TYPE locker_status AS ENUM ('available', 'occupied');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- TABELA DE EQUIPAMENTOS
-- =============================================
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  patrimony_code TEXT UNIQUE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  available_quantity INTEGER NOT NULL DEFAULT 1,
  location TEXT NOT NULL,
  campus campus_enum NOT NULL,
  description TEXT,
  category TEXT,
  image_url TEXT,
  status equipment_status NOT NULL DEFAULT 'available',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Políticas de equipamentos
CREATE POLICY "Authenticated users can view equipment"
ON public.equipment FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and collaborators can insert equipment"
ON public.equipment FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Admins and collaborators can update equipment"
ON public.equipment FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Only admins can delete equipment"
ON public.equipment FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA DE EMPRÉSTIMOS DE EQUIPAMENTOS
-- =============================================
CREATE TABLE public.equipment_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  quantity_borrowed INTEGER NOT NULL DEFAULT 1,
  borrower_name TEXT NOT NULL,
  borrower_sector TEXT NOT NULL,
  borrower_phone TEXT NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status loan_status NOT NULL DEFAULT 'active',
  loaned_by UUID REFERENCES auth.users(id),
  returned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_loans ENABLE ROW LEVEL SECURITY;

-- Políticas de empréstimos de equipamentos
CREATE POLICY "Authenticated users can view equipment loans"
ON public.equipment_loans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and collaborators can insert equipment loans"
ON public.equipment_loans FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Admins and collaborators can update equipment loans"
ON public.equipment_loans FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Only admins can delete equipment loans"
ON public.equipment_loans FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_equipment_loans_updated_at
  BEFORE UPDATE ON public.equipment_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA DE ESCANINHOS
-- =============================================
CREATE TABLE public.lockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  campus campus_enum NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  status locker_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;

-- Políticas de escaninhos
CREATE POLICY "Authenticated users can view lockers"
ON public.lockers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and collaborators can insert lockers"
ON public.lockers FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Admins and collaborators can update lockers"
ON public.lockers FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Only admins can delete lockers"
ON public.lockers FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_lockers_updated_at
  BEFORE UPDATE ON public.lockers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA DE EMPRÉSTIMOS DE ESCANINHOS
-- =============================================
CREATE TABLE public.locker_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  borrower_name TEXT NOT NULL,
  borrower_phone TEXT NOT NULL,
  borrower_sector TEXT,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status loan_status NOT NULL DEFAULT 'active',
  loaned_by UUID REFERENCES auth.users(id),
  returned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locker_loans ENABLE ROW LEVEL SECURITY;

-- Políticas de empréstimos de escaninhos
CREATE POLICY "Authenticated users can view locker loans"
ON public.locker_loans FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and collaborators can insert locker loans"
ON public.locker_loans FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Admins and collaborators can update locker loans"
ON public.locker_loans FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Only admins can delete locker loans"
ON public.locker_loans FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_locker_loans_updated_at
  BEFORE UPDATE ON public.locker_loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA DE SALAS
-- =============================================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  campus campus_enum NOT NULL,
  building TEXT NOT NULL,
  floor TEXT,
  capacity INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Políticas de salas
CREATE POLICY "Authenticated users can view rooms"
ON public.rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and collaborators can insert rooms"
ON public.rooms FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Admins and collaborators can update rooms"
ON public.rooms FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'collaborator')
);

CREATE POLICY "Only admins can delete rooms"
ON public.rooms FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABELA DE PERGUNTAS DO CHECKLIST
-- =============================================
CREATE TABLE public.checklist_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  category TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_questions ENABLE ROW LEVEL SECURITY;

-- Políticas de perguntas
CREATE POLICY "Authenticated users can view checklist questions"
ON public.checklist_questions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage checklist questions"
ON public.checklist_questions FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- =============================================
-- TABELA DE CHECKLISTS PREENCHIDOS
-- =============================================
CREATE TABLE public.room_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  filled_by UUID NOT NULL REFERENCES auth.users(id),
  shift TEXT NOT NULL,
  observations TEXT,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_checklists ENABLE ROW LEVEL SECURITY;

-- Políticas de checklists preenchidos
CREATE POLICY "Authenticated users can view room checklists"
ON public.room_checklists FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert room checklists"
ON public.room_checklists FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = filled_by);

CREATE POLICY "Only admins can delete room checklists"
ON public.room_checklists FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- =============================================
-- TABELA DE RESPOSTAS DO CHECKLIST
-- =============================================
CREATE TABLE public.checklist_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.room_checklists(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.checklist_questions(id) ON DELETE CASCADE,
  answer BOOLEAN NOT NULL,
  notes TEXT
);

ALTER TABLE public.checklist_answers ENABLE ROW LEVEL SECURITY;

-- Políticas de respostas
CREATE POLICY "Authenticated users can view checklist answers"
ON public.checklist_answers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert checklist answers"
ON public.checklist_answers FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================
-- INSERIR PERGUNTAS PADRÃO DO CHECKLIST
-- =============================================
INSERT INTO public.checklist_questions (question, category, order_index) VALUES
('A sala está limpa e organizada?', 'Limpeza', 1),
('O lixo foi retirado?', 'Limpeza', 2),
('As janelas estão limpas?', 'Limpeza', 3),
('O ar condicionado está funcionando?', 'Equipamentos', 4),
('As luzes estão funcionando?', 'Equipamentos', 5),
('O projetor/TV está funcionando?', 'Equipamentos', 6),
('Os computadores estão funcionando?', 'Equipamentos', 7),
('As cadeiras estão em bom estado?', 'Mobiliário', 8),
('As mesas estão em bom estado?', 'Mobiliário', 9),
('O quadro branco está limpo?', 'Mobiliário', 10),
('A porta fecha corretamente?', 'Segurança', 11),
('As tomadas estão funcionando?', 'Segurança', 12),
('Há materiais de primeiros socorros disponíveis?', 'Segurança', 13),
('A sinalização de emergência está visível?', 'Segurança', 14),
('O extintor de incêndio está acessível?', 'Segurança', 15);

-- ------------------------------------------------------------
-- 20251209124629_16e92da1-32c9-4bae-8dd2-e648755d271a.sql
-- ------------------------------------------------------------
-- Drop the overly permissive SELECT policy on equipment_loans
DROP POLICY IF EXISTS "Authenticated users can view equipment loans" ON public.equipment_loans;

-- Create a more restrictive SELECT policy - only admins and collaborators can view
CREATE POLICY "Admins and collaborators can view equipment loans" 
ON public.equipment_loans 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Also fix locker_loans which has the same issue
DROP POLICY IF EXISTS "Authenticated users can view locker loans" ON public.locker_loans;

CREATE POLICY "Admins and collaborators can view locker loans" 
ON public.locker_loans 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- ------------------------------------------------------------
-- 20251209154335_4794a37d-c318-4167-87b6-b294c1e188d0.sql
-- ------------------------------------------------------------
-- Create reservation_rooms table for classroom management
CREATE TABLE public.reservation_rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    location TEXT,
    campus campus_enum NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservations table
CREATE TABLE public.reservations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT,
    attendees_count INTEGER NOT NULL DEFAULT 1,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    is_external BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    approved_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reservation_logs table for history
CREATE TABLE public.reservation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    room_id UUID REFERENCES public.reservation_rooms(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    performed_by UUID,
    performer_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create function to check for reservation conflicts
CREATE OR REPLACE FUNCTION public.check_reservation_conflict(
    p_room_id UUID,
    p_start_datetime TIMESTAMP WITH TIME ZONE,
    p_end_datetime TIMESTAMP WITH TIME ZONE,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE room_id = p_room_id
          AND status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (p_start_datetime >= start_datetime AND p_start_datetime < end_datetime)
              OR (p_end_datetime > start_datetime AND p_end_datetime <= end_datetime)
              OR (p_start_datetime <= start_datetime AND p_end_datetime >= end_datetime)
          )
    );
END;
$$;

-- Create function to find available rooms
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime TIMESTAMP WITH TIME ZONE,
    p_end_datetime TIMESTAMP WITH TIME ZONE,
    p_attendees_count INTEGER DEFAULT 1,
    p_campus campus_enum DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    capacity INTEGER,
    description TEXT,
    location TEXT,
    campus campus_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.room_id = rr.id
            AND r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
      )
    ORDER BY rr.code;
END;
$$;

-- Enable RLS
ALTER TABLE public.reservation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for reservation_rooms
CREATE POLICY "Anyone can view active rooms"
ON public.reservation_rooms
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can manage rooms"
ON public.reservation_rooms
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- RLS policies for reservations
CREATE POLICY "Authenticated users can view reservations"
ON public.reservations
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert reservations"
ON public.reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins and collaborators can update reservations"
ON public.reservations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Only admins can delete reservations"
ON public.reservations
FOR DELETE
USING (is_admin(auth.uid()));

-- RLS policies for reservation_logs
CREATE POLICY "Authenticated users can view logs"
ON public.reservation_logs
FOR SELECT
USING (true);

CREATE POLICY "System can insert logs"
ON public.reservation_logs
FOR INSERT
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_reservation_rooms_updated_at
BEFORE UPDATE ON public.reservation_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default classrooms (01 to 10)
INSERT INTO public.reservation_rooms (name, code, capacity, location, campus, description) VALUES
('Sala de Aula 01', 'SALA-01', 40, 'Bloco A - Térreo', 'Campus I', 'Sala de aula padrão com projetor'),
('Sala de Aula 02', 'SALA-02', 40, 'Bloco A - Térreo', 'Campus I', 'Sala de aula padrão com projetor'),
('Sala de Aula 03', 'SALA-03', 35, 'Bloco A - 1º Andar', 'Campus I', 'Sala de aula com ar condicionado'),
('Sala de Aula 04', 'SALA-04', 35, 'Bloco A - 1º Andar', 'Campus I', 'Sala de aula com ar condicionado'),
('Sala de Aula 05', 'SALA-05', 30, 'Bloco B - Térreo', 'Campus I', 'Sala de aula com computadores'),
('Sala de Aula 06', 'SALA-06', 30, 'Bloco B - Térreo', 'Campus I', 'Sala de aula com computadores'),
('Sala de Aula 07', 'SALA-07', 50, 'Bloco B - 1º Andar', 'Campus I', 'Auditório pequeno'),
('Sala de Aula 08', 'SALA-08', 25, 'Bloco C - Térreo', 'Campus I', 'Sala de reuniões'),
('Sala de Aula 09', 'SALA-09', 20, 'Bloco C - Térreo', 'Campus I', 'Laboratório de práticas'),
('Sala de Aula 10', 'SALA-10', 45, 'Bloco C - 1º Andar', 'Campus I', 'Sala multiuso');

-- ------------------------------------------------------------
-- 20251209162707_f81dc3ad-5e12-4bbb-ad25-02f6b4adae08.sql
-- ------------------------------------------------------------
-- Add email column to locker_loans table
ALTER TABLE public.locker_loans ADD COLUMN borrower_email text;

-- ------------------------------------------------------------
-- 20251209165015_db192409-17c6-47e4-b5d4-edd73ea11969.sql
-- ------------------------------------------------------------
-- Create app_settings table for global settings like blocking external bookings
CREATE TABLE public.app_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL DEFAULT '{}',
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage settings
CREATE POLICY "Admins can manage settings" 
ON public.app_settings 
FOR ALL 
USING (is_admin(auth.uid()));

-- Anyone can read settings (needed for external booking page to check if blocked)
CREATE POLICY "Anyone can read settings" 
ON public.app_settings 
FOR SELECT 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default setting for external booking
INSERT INTO public.app_settings (key, value, description) VALUES 
('external_booking_blocked', '{"blocked": false, "blocked_until": null, "message": ""}', 'Settings for blocking external reservations');

-- Create lost_items table for achados e perdidos
CREATE TABLE public.lost_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    description text NOT NULL,
    image_url text,
    campus public.campus_enum NOT NULL,
    found_location text NOT NULL,
    found_date date NOT NULL,
    received_date date NOT NULL,
    shelf text,
    box text,
    seal_number text,
    delivered_by_name text NOT NULL,
    delivered_by_contact text,
    registered_by uuid REFERENCES auth.users(id),
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'delivered', 'expired')),
    owner_name text,
    owner_email text,
    owner_phone text,
    owner_signature text,
    delivered_at timestamp with time zone,
    delivered_by_team_member uuid REFERENCES auth.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lost_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view lost items (public search)
CREATE POLICY "Anyone can view lost items" 
ON public.lost_items 
FOR SELECT 
USING (true);

-- Admins and collaborators can insert
CREATE POLICY "Admins and collaborators can insert lost items" 
ON public.lost_items 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Admins and collaborators can update
CREATE POLICY "Admins and collaborators can update lost items" 
ON public.lost_items 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Only admins can delete
CREATE POLICY "Only admins can delete lost items" 
ON public.lost_items 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_lost_items_updated_at
BEFORE UPDATE ON public.lost_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-expire items older than 90 days
CREATE OR REPLACE FUNCTION public.expire_old_lost_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.lost_items
    SET status = 'expired', updated_at = now()
    WHERE status = 'available'
      AND received_date < CURRENT_DATE - INTERVAL '90 days';
END;
$$;

-- ------------------------------------------------------------
-- 20251209171530_11eec5d4-3c4b-493f-bac5-83fac2a9d6c5.sql
-- ------------------------------------------------------------
-- Create room_combinations table to store linked rooms
CREATE TABLE public.room_combinations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    linked_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(parent_room_id, linked_room_id)
);

-- Enable RLS
ALTER TABLE public.room_combinations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view room combinations"
ON public.room_combinations
FOR SELECT
USING (true);

CREATE POLICY "Admins and collaborators can manage room combinations"
ON public.room_combinations
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Create function to get all rooms that should be blocked when a room is reserved
CREATE OR REPLACE FUNCTION public.get_linked_rooms(p_room_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result UUID[];
BEGIN
    -- Get rooms linked to this room (as parent)
    SELECT ARRAY_AGG(linked_room_id) INTO result
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    RETURN COALESCE(result, ARRAY[]::UUID[]);
END;
$$;

-- Update find_available_rooms to exclude linked rooms
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime TIMESTAMP WITH TIME ZONE, 
    p_end_datetime TIMESTAMP WITH TIME ZONE, 
    p_attendees_count INTEGER DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, code TEXT, capacity INTEGER, description TEXT, location TEXT, campus campus_enum)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
            AND (
                r.room_id = rr.id
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
            )
      )
    ORDER BY rr.code;
END;
$$;

-- Update check_reservation_conflict to consider linked rooms
CREATE OR REPLACE FUNCTION public.check_reservation_conflict(
    p_room_id UUID, 
    p_start_datetime TIMESTAMP WITH TIME ZONE, 
    p_end_datetime TIMESTAMP WITH TIME ZONE, 
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
BEGIN
    -- Get rooms linked to this room
    SELECT ARRAY_AGG(linked_room_id) INTO linked_rooms
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    -- Get parent rooms that link to this room
    SELECT ARRAY_AGG(parent_room_id) INTO parent_rooms
    FROM public.room_combinations
    WHERE linked_room_id = p_room_id;
    
    linked_rooms := COALESCE(linked_rooms, ARRAY[]::UUID[]);
    parent_rooms := COALESCE(parent_rooms, ARRAY[]::UUID[]);

    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (p_start_datetime >= start_datetime AND p_start_datetime < end_datetime)
              OR (p_end_datetime > start_datetime AND p_end_datetime <= end_datetime)
              OR (p_start_datetime <= start_datetime AND p_end_datetime >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$$;

-- ------------------------------------------------------------
-- 20251209195442_73c39f02-ca37-4560-869d-d75a845e69b9.sql
-- ------------------------------------------------------------
-- Add auto_confirm column to reservation_rooms table
-- When true, reservations for this room are automatically confirmed
-- When false, reservations need manual confirmation from collaborators
ALTER TABLE public.reservation_rooms 
ADD COLUMN auto_confirm boolean NOT NULL DEFAULT true;

-- Add comment to explain the column
COMMENT ON COLUMN public.reservation_rooms.auto_confirm IS 'When true, reservations are automatically confirmed. When false, they require manual confirmation from collaborators.';

-- Update find_available_rooms function to also check if parent rooms are blocked
-- when a linked room is reserved
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_attendees_count integer DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL::campus_enum
)
RETURNS TABLE(
    id uuid, 
    name text, 
    code text, 
    capacity integer, 
    description text, 
    location text, 
    campus campus_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (p_start_datetime >= r.start_datetime AND p_start_datetime < r.end_datetime)
                OR (p_end_datetime > r.start_datetime AND p_end_datetime <= r.end_datetime)
                OR (p_start_datetime <= r.start_datetime AND p_end_datetime >= r.end_datetime)
            )
            AND (
                -- Direct reservation on this room
                r.room_id = rr.id
                -- Reservation on a linked room (this room is parent)
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                -- Reservation on a parent room (this room is linked)
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
                -- NEW: This room is a parent and one of its linked rooms has a reservation
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id AND rc.linked_room_id = r.room_id
                )
                -- NEW: This room is a parent and one of its linked rooms is blocked by another parent
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id 
                    AND rc.linked_room_id = ANY(get_linked_rooms(r.room_id))
                )
            )
      )
    ORDER BY rr.code;
END;
$function$;

-- ------------------------------------------------------------
-- 20251210113638_d7166fab-e75e-41bb-adc5-3b08bc73f779.sql
-- ------------------------------------------------------------
-- Add is_fixed column to reservations for fixed reservations (recurring)
ALTER TABLE public.reservations 
ADD COLUMN is_fixed boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 20251210123049_1d1ba951-243e-4c2d-a87b-89beb2c18266.sql
-- ------------------------------------------------------------
-- Create material requests table
CREATE TABLE public.material_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id UUID NOT NULL,
    requester_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'delivered')),
    admin_notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own requests"
ON public.material_requests FOR SELECT
USING (auth.uid() = requester_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

CREATE POLICY "Authenticated users can create requests"
ON public.material_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Admins and collaborators can update requests"
ON public.material_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

CREATE POLICY "Only admins can delete requests"
ON public.material_requests FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_material_requests_updated_at
BEFORE UPDATE ON public.material_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20251210124219_4c6b79b6-aead-4bcd-9420-d760327d7c6b.sql
-- ------------------------------------------------------------
-- Create external equipment loan requests table
CREATE TABLE public.external_equipment_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id UUID REFERENCES public.equipment(id) ON DELETE CASCADE,
    equipment_name TEXT NOT NULL,
    quantity_requested INTEGER NOT NULL DEFAULT 1,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    requester_organization TEXT,
    purpose TEXT NOT NULL,
    requested_date DATE NOT NULL,
    expected_return_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'loaned', 'returned')),
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.external_equipment_requests ENABLE ROW LEVEL SECURITY;

-- Policies - anyone can create requests (external users)
CREATE POLICY "Anyone can create external equipment requests"
ON public.external_equipment_requests FOR INSERT
WITH CHECK (true);

-- Anyone can view their own requests by email
CREATE POLICY "Anyone can view requests by email"
ON public.external_equipment_requests FOR SELECT
USING (true);

-- Admins and collaborators can update requests
CREATE POLICY "Admins and collaborators can update external requests"
ON public.external_equipment_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Only admins can delete
CREATE POLICY "Only admins can delete external requests"
ON public.external_equipment_requests FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_external_equipment_requests_updated_at
BEFORE UPDATE ON public.external_equipment_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20251210125235_9c5b0eb1-e842-4956-8a26-e4c91e173704.sql
-- ------------------------------------------------------------
-- Add assigned_to column to material_requests table
ALTER TABLE public.material_requests
ADD COLUMN assigned_to uuid REFERENCES auth.users(id),
ADD COLUMN assigned_to_name text;

-- Add index for better performance
CREATE INDEX idx_material_requests_assigned_to ON public.material_requests(assigned_to);

-- ------------------------------------------------------------
-- 20251210130945_bd76fdd2-a8ac-442b-9b8f-6371577d170d.sql
-- ------------------------------------------------------------
-- Create table for reservation reschedulings
CREATE TABLE public.reservation_reschedulings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    original_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id),
    new_room_id UUID NOT NULL REFERENCES public.reservation_rooms(id),
    original_start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    original_end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    new_start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    new_end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    rescheduled_by UUID REFERENCES auth.users(id),
    rescheduled_by_name TEXT,
    is_recurring_update BOOLEAN NOT NULL DEFAULT false,
    affected_reservations_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.reservation_reschedulings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view reschedulings" 
ON public.reservation_reschedulings 
FOR SELECT 
USING (true);

CREATE POLICY "Admins and collaborators can insert reschedulings" 
ON public.reservation_reschedulings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can update reschedulings" 
ON public.reservation_reschedulings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Only admins can delete reschedulings" 
ON public.reservation_reschedulings 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_reschedulings_reservation_id ON public.reservation_reschedulings(reservation_id);
CREATE INDEX idx_reschedulings_created_at ON public.reservation_reschedulings(created_at DESC);
CREATE INDEX idx_reschedulings_new_start_datetime ON public.reservation_reschedulings(new_start_datetime);

-- Enable realtime for reschedulings table
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_reschedulings;

-- ------------------------------------------------------------
-- 20251210132253_369718c0-4215-4613-98ec-a20c1e127da0.sql
-- ------------------------------------------------------------
-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can view reservations" 
ON public.reservations 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20251210132909_ebe5cd92-4c1d-4153-b2d4-a9b590bc01a6.sql
-- ------------------------------------------------------------
-- Update the reservations INSERT policy to require authentication for direct inserts
-- External reservations will go through the edge function which uses service role

DROP POLICY IF EXISTS "Anyone can insert reservations" ON public.reservations;

-- Only authenticated users can insert reservations directly
CREATE POLICY "Authenticated users can insert reservations" 
ON public.reservations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20251210133734_a8dd55a3-8f1b-475e-9d25-0411b2974225.sql
-- ------------------------------------------------------------
-- Fix: Restrict reservation_logs SELECT access to admins and collaborators only
DROP POLICY IF EXISTS "Authenticated users can view logs" ON public.reservation_logs;

CREATE POLICY "Admins and collaborators can view logs" 
ON public.reservation_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- ------------------------------------------------------------
-- 20251210134523_0f66d8f2-1b23-4308-933e-a493b1ff1b00.sql
-- ------------------------------------------------------------
-- Fix: Restrict lost_items SELECT access to authenticated users only
DROP POLICY IF EXISTS "Anyone can view lost items" ON public.lost_items;

CREATE POLICY "Authenticated users can view lost items" 
ON public.lost_items 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20251210135105_ba353f28-ecc4-4688-ad5f-2149b8e6f692.sql
-- ------------------------------------------------------------
-- Fix: Restrict external_equipment_requests SELECT access to admins and collaborators only
-- This prevents public exposure of PII (names, emails, phone numbers)

DROP POLICY IF EXISTS "Anyone can view requests by email" ON public.external_equipment_requests;

CREATE POLICY "Admins and collaborators can view external requests" 
ON public.external_equipment_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- ------------------------------------------------------------
-- 20251210181519_ea3893c9-61b3-4e45-9714-3aca746cb4a2.sql
-- ------------------------------------------------------------
-- Create classroom calls table for teacher requests
CREATE TABLE public.classroom_calls (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    accepted_by UUID REFERENCES auth.users(id),
    accepted_by_name TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.classroom_calls ENABLE ROW LEVEL SECURITY;

-- Anyone can create calls (public access for teachers)
CREATE POLICY "Anyone can create classroom calls" 
ON public.classroom_calls 
FOR INSERT 
WITH CHECK (true);

-- Admins and collaborators can view all calls
CREATE POLICY "Admins and collaborators can view classroom calls" 
ON public.classroom_calls 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- Admins and collaborators can update calls (accept/resolve)
CREATE POLICY "Admins and collaborators can update classroom calls" 
ON public.classroom_calls 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- Only admins can delete calls
CREATE POLICY "Only admins can delete classroom calls" 
ON public.classroom_calls 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_calls;

-- ------------------------------------------------------------
-- 20251210191056_144d0bff-5db3-44bb-95bb-a5a84fbb2461.sql
-- ------------------------------------------------------------
-- Create external_users table for external requesters with login
CREATE TABLE public.external_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cpf TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for CPF searches
CREATE INDEX idx_external_users_cpf ON public.external_users(cpf);
CREATE INDEX idx_external_users_email ON public.external_users(email);

-- Enable RLS
ALTER TABLE public.external_users ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own external profile
CREATE POLICY "External users can view their own profile" 
ON public.external_users 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "External users can update their own profile" 
ON public.external_users 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "External users can insert their own profile" 
ON public.external_users 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admins and collaborators can view all external users
CREATE POLICY "Admins and collaborators can view all external users" 
ON public.external_users 
FOR SELECT 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Admins and collaborators can update external users
CREATE POLICY "Admins and collaborators can manage external users" 
ON public.external_users 
FOR ALL 
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'collaborator'));

-- Trigger for updated_at
CREATE TRIGGER update_external_users_updated_at
BEFORE UPDATE ON public.external_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add external_user_id to reservations table to link external reservations to external users
ALTER TABLE public.reservations ADD COLUMN external_user_id UUID REFERENCES public.external_users(id);

-- Add index for external user lookups
CREATE INDEX idx_reservations_external_user ON public.reservations(external_user_id);

-- Add requester_cpf to reservations for cases where user not linked yet
ALTER TABLE public.reservations ADD COLUMN requester_cpf TEXT;

-- ------------------------------------------------------------
-- 20251210194556_e0180a1a-13b7-41c4-b43e-b2eb430c59b5.sql
-- ------------------------------------------------------------
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins and collaborators can manage external users" ON public.external_users;

-- Create separate policies for each operation
CREATE POLICY "Admins and collaborators can insert external users" 
ON public.external_users 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can update external users" 
ON public.external_users 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "Admins and collaborators can delete external users" 
ON public.external_users 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

-- ------------------------------------------------------------
-- 20251211121201_0a1c860d-b36c-42a2-ac3f-3329c87659fc.sql
-- ------------------------------------------------------------
-- Drop existing INSERT policies first
DROP POLICY IF EXISTS "Admins and collaborators can insert external users" ON public.external_users;
DROP POLICY IF EXISTS "External users can insert their own profile" ON public.external_users;

-- Recreate as PERMISSIVE (default behavior - only ONE needs to be true)
CREATE POLICY "Admins and collaborators can insert external users" 
ON public.external_users 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'collaborator'::app_role));

CREATE POLICY "External users can insert their own profile" 
ON public.external_users 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 20251211125946_dcd5ff67-b676-4f5d-a461-bda9580afd80.sql
-- ------------------------------------------------------------
-- Add user_type and sector columns to external_users
ALTER TABLE public.external_users
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'professor',
ADD COLUMN IF NOT EXISTS sector text;

-- Add a check constraint for user_type
ALTER TABLE public.external_users
ADD CONSTRAINT external_users_user_type_check
CHECK (user_type IN ('professor', 'colaborador'));

-- ------------------------------------------------------------
-- 20251211133202_2c6fd3da-ab2b-4664-9e85-153427555efb.sql
-- ------------------------------------------------------------

-- Update check_reservation_conflict to add 15 min buffer for external reservations
CREATE OR REPLACE FUNCTION public.check_reservation_conflict(
    p_room_id uuid, 
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_exclude_reservation_id uuid DEFAULT NULL::uuid,
    p_is_external boolean DEFAULT false
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    linked_rooms UUID[];
    parent_rooms UUID[];
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

    -- Get rooms linked to this room
    SELECT ARRAY_AGG(linked_room_id) INTO linked_rooms
    FROM public.room_combinations
    WHERE parent_room_id = p_room_id;
    
    -- Get parent rooms that link to this room
    SELECT ARRAY_AGG(parent_room_id) INTO parent_rooms
    FROM public.room_combinations
    WHERE linked_room_id = p_room_id;
    
    linked_rooms := COALESCE(linked_rooms, ARRAY[]::UUID[]);
    parent_rooms := COALESCE(parent_rooms, ARRAY[]::UUID[]);

    RETURN EXISTS (
        SELECT 1
        FROM public.reservations
        WHERE status NOT IN ('cancelled')
          AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id)
          AND (
              (check_start >= start_datetime AND check_start < end_datetime)
              OR (check_end > start_datetime AND check_end <= end_datetime)
              OR (check_start <= start_datetime AND check_end >= end_datetime)
          )
          AND (
              room_id = p_room_id
              OR room_id = ANY(linked_rooms)
              OR room_id = ANY(parent_rooms)
          )
    );
END;
$function$;

-- Update find_available_rooms to add 15 min buffer for external use
CREATE OR REPLACE FUNCTION public.find_available_rooms(
    p_start_datetime timestamp with time zone, 
    p_end_datetime timestamp with time zone, 
    p_attendees_count integer DEFAULT 1, 
    p_campus campus_enum DEFAULT NULL::campus_enum,
    p_is_external boolean DEFAULT false
)
 RETURNS TABLE(id uuid, name text, code text, capacity integer, description text, location text, campus campus_enum)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    check_start TIMESTAMP WITH TIME ZONE;
    check_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- For external reservations, add 15 minute buffer before and after
    IF p_is_external THEN
        check_start := p_start_datetime - INTERVAL '15 minutes';
        check_end := p_end_datetime + INTERVAL '15 minutes';
    ELSE
        check_start := p_start_datetime;
        check_end := p_end_datetime;
    END IF;

    RETURN QUERY
    SELECT 
        rr.id,
        rr.name,
        rr.code,
        rr.capacity,
        rr.description,
        rr.location,
        rr.campus
    FROM public.reservation_rooms rr
    WHERE rr.is_active = true
      AND rr.capacity >= p_attendees_count
      AND (p_campus IS NULL OR rr.campus = p_campus)
      AND NOT EXISTS (
          SELECT 1
          FROM public.reservations r
          WHERE r.status NOT IN ('cancelled')
            AND (
                (check_start >= r.start_datetime AND check_start < r.end_datetime)
                OR (check_end > r.start_datetime AND check_end <= r.end_datetime)
                OR (check_start <= r.start_datetime AND check_end >= r.end_datetime)
            )
            AND (
                -- Direct reservation on this room
                r.room_id = rr.id
                -- Reservation on a linked room (this room is parent)
                OR rr.id = ANY(get_linked_rooms(r.room_id))
                -- Reservation on a parent room (this room is linked)
                OR r.room_id = ANY(
                    SELECT rc.parent_room_id FROM public.room_combinations rc WHERE rc.linked_room_id = rr.id
                )
                -- NEW: This room is a parent and one of its linked rooms has a reservation
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id AND rc.linked_room_id = r.room_id
                )
                -- NEW: This room is a parent and one of its linked rooms is blocked by another parent
                OR EXISTS (
                    SELECT 1 FROM public.room_combinations rc 
                    WHERE rc.parent_room_id = rr.id 
                    AND rc.linked_room_id = ANY(get_linked_rooms(r.room_id))
                )
            )
      )
    ORDER BY rr.code;
END;
$function$;

-- ------------------------------------------------------------
-- 20251211135642_8a9d56bb-827a-41fb-8c11-6dfa0f10178a.sql
-- ------------------------------------------------------------
-- Drop the existing overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can create classroom calls" ON public.classroom_calls;

-- Create a new policy that requires authentication
CREATE POLICY "Authenticated users can create classroom calls" 
ON public.classroom_calls 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20251211155211_d5e1e017-4c1b-46b4-a83a-10ec6e435db1.sql
-- ------------------------------------------------------------
-- Add policy to allow anyone to read a specific classroom call by ID
-- This enables real-time updates for external users who just created a call
CREATE POLICY "Anyone can view their submitted call by ID" 
ON public.classroom_calls 
FOR SELECT 
USING (true);

-- ------------------------------------------------------------
-- 20251212153712_d36b3bd8-d136-409e-ae2a-41dd15e0c1ca.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251212155435_bbc6366b-b7ac-4abf-a783-4cb97152c24e.sql
-- ------------------------------------------------------------
-- Update profiles policies to add with_check
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Update user_roles policies to add with_check
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 20251212162611_b8fb58ae-813c-42f9-8121-67488766fe11.sql
-- ------------------------------------------------------------
-- Enable realtime for remaining tables (skip those already enabled)
DO $$
BEGIN
  -- Try adding each table, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_rooms;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_loans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.external_equipment_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lockers;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_loans;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_calls;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- 20251212181715_29e3d5bf-e620-45b3-84f0-8d884178915c.sql
-- ------------------------------------------------------------
-- Add max_advance_days column to reservation_rooms table
-- This will allow configuring how many days in advance each room can be reserved
ALTER TABLE public.reservation_rooms 
ADD COLUMN IF NOT EXISTS max_advance_days INTEGER DEFAULT NULL;

-- A NULL value means no limit on advance booking
COMMENT ON COLUMN public.reservation_rooms.max_advance_days IS 'Maximum number of days in advance this room can be reserved. NULL means no limit.';

-- ------------------------------------------------------------
-- 20251212182234_5a653dac-fa3e-4542-bc0f-d967867d3c6c.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251215152918_463f8277-7e8a-49bf-b7b4-f7141984cbb2.sql
-- ------------------------------------------------------------
-- Create storage bucket for lost items images
INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-items', 'lost-items', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload lost item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lost-items');

-- Allow public read access to lost item images
CREATE POLICY "Anyone can view lost item images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lost-items');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update lost item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lost-items');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete lost item images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lost-items');

-- ------------------------------------------------------------
-- 20251215165031_7f02fe12-c401-4e81-91cb-761fad3f521d.sql
-- ------------------------------------------------------------
-- Make the lost-items bucket private
UPDATE storage.buckets SET public = false WHERE id = 'lost-items';

-- Drop the public SELECT policy
DROP POLICY IF EXISTS "Anyone can view lost item images" ON storage.objects;

-- Create policy for authenticated users only to view images
CREATE POLICY "Authenticated users can view lost item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'lost-items' AND auth.uid() IS NOT NULL);

-- Keep existing INSERT policy for internal users (already exists)

-- ------------------------------------------------------------
-- 20251215181432_39f137af-e24e-46e0-b80b-4262a42f8d3d.sql
-- ------------------------------------------------------------
-- Add room-specific checklist items column to rooms table
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS checklist_items jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.rooms.checklist_items IS 'JSON array of room-specific checklist items, each with id, label fields';

-- ------------------------------------------------------------
-- 20251215185716_bf79c4c0-7698-40f0-9c46-0fdc2beb30bd.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251215190117_4e27dd0f-575d-47b9-9c07-77a753f0049e.sql
-- ------------------------------------------------------------
-- Create tasks/demands table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'pending',
    category TEXT,
    due_date DATE,
    created_by UUID,
    assigned_to UUID,
    created_by_name TEXT NOT NULL,
    assigned_to_name TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2),
    tags TEXT[],
    attachments JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task history table
CREATE TABLE IF NOT EXISTS public.task_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
DROP POLICY IF EXISTS "Admins and analistas can manage tasks" ON public.tasks;
CREATE POLICY "Admins and analistas can manage tasks"
ON public.tasks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role));

DROP POLICY IF EXISTS "Assigned users can view their tasks" ON public.tasks;
CREATE POLICY "Assigned users can view their tasks"
ON public.tasks FOR SELECT
USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.tasks;
CREATE POLICY "Assigned users can update their tasks"
ON public.tasks FOR UPDATE
USING (assigned_to = auth.uid());

-- RLS policies for task_comments
DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.task_comments;
CREATE POLICY "Authenticated users can view comments"
ON public.task_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.task_comments;
CREATE POLICY "Authenticated users can insert comments"
ON public.task_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.task_comments;
CREATE POLICY "Users can delete their own comments"
ON public.task_comments FOR DELETE
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for task_history
DROP POLICY IF EXISTS "Authenticated users can view task history" ON public.task_history;
CREATE POLICY "Authenticated users can view task history"
ON public.task_history FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;
CREATE POLICY "System can insert task history"
ON public.task_history FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updated_at if not exists
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20251215194233_ec9b20d5-4eab-40e4-a109-608e97d211ba.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251216121523_6ec9bb80-ba71-45cd-aeb4-d4d9a002668e.sql
-- ------------------------------------------------------------
-- Add supervisor role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';

-- ------------------------------------------------------------
-- 20251216121616_224d1c70-c9e1-41e1-b0ad-bf38af3cfb07.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251216132446_853d452d-36a1-4c34-b6d1-4b495f21fa13.sql
-- ------------------------------------------------------------
-- Allow all authenticated users to insert tasks
CREATE POLICY "All authenticated users can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to view all tasks (not just assigned ones)
DROP POLICY IF EXISTS "Assigned users can view their tasks" ON public.tasks;

CREATE POLICY "Authenticated users can view all tasks"
ON public.tasks
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20251216132556_e9e8e230-9536-4ae6-a3c6-14a6775cb4b4.sql
-- ------------------------------------------------------------
-- Enable realtime for tasks, user_roles and role_permissions tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ------------------------------------------------------------
-- 20251216163104_cfa162f9-469d-44b6-a80d-85210a3b1931.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251216163213_f545b7df-121a-48f9-8564-81bfa601a99c.sql
-- ------------------------------------------------------------
-- Fix: Update RLS policy to allow supervisor to view activity logs
DROP POLICY IF EXISTS "Admins and analistas can view activity logs" ON public.activity_logs;

CREATE POLICY "Internal users can view activity logs"
  ON public.activity_logs
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role)
  );

-- ------------------------------------------------------------
-- 20251216164423_ea6959c7-956b-4c30-8adf-37e4e523f617.sql
-- ------------------------------------------------------------
-- Drop existing policies on locker_loans
DROP POLICY IF EXISTS "Admins and analistas can insert locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and analistas can update locker loans" ON public.locker_loans;
DROP POLICY IF EXISTS "Admins and analistas can view locker loans" ON public.locker_loans;

-- Create new policies that include assistente and supervisor
CREATE POLICY "Internal users can insert locker loans" 
ON public.locker_loans 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update locker loans" 
ON public.locker_loans 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can view locker loans" 
ON public.locker_loans 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Also need to allow internal users to update lockers status
DROP POLICY IF EXISTS "Admins and analistas can update lockers" ON public.lockers;

CREATE POLICY "Internal users can update lockers" 
ON public.lockers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251216164618_11de9cba-98e8-4273-b8cd-bcfd84369a96.sql
-- ------------------------------------------------------------
-- =============================================
-- UPDATE equipment_loans POLICIES
-- =============================================

-- Drop existing restrictive policies on equipment_loans
DROP POLICY IF EXISTS "Admins and analistas can insert equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and analistas can update equipment loans" ON public.equipment_loans;
DROP POLICY IF EXISTS "Admins and analistas can view equipment loans" ON public.equipment_loans;

-- Create new policies for all internal users
CREATE POLICY "Internal users can insert equipment loans" 
ON public.equipment_loans 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update equipment loans" 
ON public.equipment_loans 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can view equipment loans" 
ON public.equipment_loans 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- =============================================
-- UPDATE lost_items POLICIES
-- =============================================

-- Drop existing restrictive policies on lost_items
DROP POLICY IF EXISTS "Internal users can insert lost items" ON public.lost_items;
DROP POLICY IF EXISTS "Admins and analistas can update lost items" ON public.lost_items;

-- Create new policies for all internal users
CREATE POLICY "Internal users can insert lost items" 
ON public.lost_items 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update lost items" 
ON public.lost_items 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251216172257_9e4d013a-fa1c-4c9f-8af1-439bac0d4fec.sql
-- ------------------------------------------------------------
-- =============================================
-- UPDATE tasks POLICIES
-- =============================================

-- Drop existing ALL policy that gives too many permissions
DROP POLICY IF EXISTS "Admins and analistas can manage tasks" ON public.tasks;

-- Keep existing INSERT policy for all authenticated users (already exists)
-- "All authenticated users can create tasks"

-- Create UPDATE policy for admins and analistas (replacing the ALL policy)
CREATE POLICY "Admins and analistas can update all tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role)
);

-- Create DELETE policy for admins only
CREATE POLICY "Only admins can delete tasks" 
ON public.tasks 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- ------------------------------------------------------------
-- 20251216173743_7f71a286-1e0f-49b1-896a-1f498322c524.sql
-- ------------------------------------------------------------
-- =============================================
-- FIX profiles RLS: Allow internal users to view all profiles
-- (needed for assignee dropdown in tasks and other modules)
-- =============================================

-- Drop restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create new policy allowing all internal users to view profiles
CREATE POLICY "Internal users can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- =============================================
-- FIX tasks UPDATE: Allow all internal users to update tasks
-- (so supervisors and assistentes can also change assignee)
-- =============================================

-- Drop existing restrictive UPDATE policies
DROP POLICY IF EXISTS "Admins and analistas can update all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.tasks;

-- Create new policy allowing all internal users to update tasks
CREATE POLICY "Internal users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251216174151_33734df4-f714-42fa-a644-29f72a6d4de0.sql
-- ------------------------------------------------------------
-- =============================================
-- FIX tasks UPDATE: Only admin OR assigned user can update
-- =============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Internal users can update tasks" ON public.tasks;

-- Create new policy: only admin OR the assigned user can update
CREATE POLICY "Admins or assigned users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  is_admin(auth.uid()) OR 
  (assigned_to = auth.uid())
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  (assigned_to = auth.uid())
);

-- ------------------------------------------------------------
-- 20251216175256_1cf9c994-2199-4d04-8cff-edd5618508e1.sql
-- ------------------------------------------------------------
-- =============================================
-- UPDATE tasks policy: admin, supervisor, assigned user, OR creator can update
-- =============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins or assigned users can update tasks" ON public.tasks;

-- Create new policy: admin, supervisor, assigned user, OR creator can update
CREATE POLICY "Admins or assigned users can update tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor') OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid())
)
WITH CHECK (
  is_admin(auth.uid()) OR 
  has_role(auth.uid(), 'supervisor') OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid())
);

-- ------------------------------------------------------------
-- 20251217122825_03297ac5-bb9f-40d2-abe9-49f4dfef3444.sql
-- ------------------------------------------------------------
-- Add allow_external_loan field to equipment table
ALTER TABLE public.equipment 
ADD COLUMN IF NOT EXISTS allow_external_loan boolean NOT NULL DEFAULT true;

-- Add write-off related fields to equipment
ALTER TABLE public.equipment 
ADD COLUMN IF NOT EXISTS write_off_date date,
ADD COLUMN IF NOT EXISTS write_off_reason text,
ADD COLUMN IF NOT EXISTS write_off_by uuid;

-- Create inventory_movements table for tracking transfers and other movements
CREATE TABLE public.inventory_movements (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    equipment_id uuid NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
    movement_type text NOT NULL CHECK (movement_type IN ('transfer', 'write_off', 'import', 'adjustment')),
    from_location text,
    to_location text,
    from_campus text,
    to_campus text,
    quantity integer NOT NULL DEFAULT 1,
    reason text,
    notes text,
    performed_by uuid,
    performed_by_name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_movements
CREATE POLICY "Internal users can view inventory movements" 
ON public.inventory_movements 
FOR SELECT 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Admins and analistas can insert inventory movements" 
ON public.inventory_movements 
FOR INSERT 
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Admins and analistas can update inventory movements" 
ON public.inventory_movements 
FOR UPDATE 
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Only admins can delete inventory movements" 
ON public.inventory_movements 
FOR DELETE 
USING (is_admin(auth.uid()));

-- Create index for better performance
CREATE INDEX idx_inventory_movements_equipment_id ON public.inventory_movements(equipment_id);
CREATE INDEX idx_inventory_movements_type ON public.inventory_movements(movement_type);
CREATE INDEX idx_inventory_movements_created_at ON public.inventory_movements(created_at DESC);

-- ------------------------------------------------------------
-- 20251217123337_3b5f157a-78f7-495d-b246-4ccb3e016036.sql
-- ------------------------------------------------------------
-- =============================================
-- ADICIONAR CAMPOS DE ASSINATURA E TROCA DE ESCANINHOS
-- =============================================

-- Adicionar campo de assinatura na devolução de escaninhos
ALTER TABLE public.locker_loans
ADD COLUMN IF NOT EXISTS return_signature TEXT,
ADD COLUMN IF NOT EXISTS returner_name TEXT;

-- Tabela para histórico de trocas de escaninhos
CREATE TABLE IF NOT EXISTS public.locker_exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_loan_id UUID NOT NULL REFERENCES public.locker_loans(id) ON DELETE CASCADE,
  old_locker_id UUID NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  new_locker_id UUID NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  new_loan_id UUID REFERENCES public.locker_loans(id) ON DELETE SET NULL,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locker_exchanges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view locker exchanges"
ON public.locker_exchanges FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'analista') OR 
  has_role(auth.uid(), 'assistente') OR
  has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Internal users can insert locker exchanges"
ON public.locker_exchanges FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'analista') OR 
  has_role(auth.uid(), 'assistente') OR
  has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Only admins can delete locker exchanges"
ON public.locker_exchanges FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- =============================================
-- ADICIONAR CAMPOS DE PROCEDÊNCIA E JUSTIFICATIVA NOS CHAMADOS
-- =============================================

ALTER TABLE public.classroom_calls
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN,
ADD COLUMN IF NOT EXISTS validation_reason TEXT,
ADD COLUMN IF NOT EXISTS treatment TEXT;

-- =============================================
-- ADICIONAR SUPORTE A EQUIPE NAS DEMANDAS
-- =============================================

-- Tabela para membros da equipe de uma demanda
CREATE TABLE IF NOT EXISTS public.task_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.task_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task team members"
ON public.task_team_members FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and supervisors can manage task team members"
ON public.task_team_members FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins and supervisors can delete task team members"
ON public.task_team_members FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

-- ------------------------------------------------------------
-- 20251217130538_c66593af-a387-4d0c-9eb4-7de8648765b0.sql
-- ------------------------------------------------------------
-- Fix equipment UPDATE policy to allow all internal users to toggle external loan
DROP POLICY IF EXISTS "Admins and analistas can update equipment" ON equipment;

CREATE POLICY "Internal users can update equipment" 
ON equipment 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Fix material_requests SELECT policy - ensure it's PERMISSIVE (default) not RESTRICTIVE
DROP POLICY IF EXISTS "Users can view their own requests" ON material_requests;

CREATE POLICY "Users can view their own requests" 
ON material_requests 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = requester_id OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role)
);

-- Also ensure internal users can view ALL material requests (for admins/analistas managing them)
-- The above policy already handles this

-- Fix inventory_movements to allow all internal users
DROP POLICY IF EXISTS "Admins and analistas can insert inventory movements" ON inventory_movements;

CREATE POLICY "Internal users can insert inventory movements" 
ON inventory_movements 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

DROP POLICY IF EXISTS "Admins and analistas can update inventory movements" ON inventory_movements;

CREATE POLICY "Internal users can update inventory movements" 
ON inventory_movements 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251217130748_14178db6-0763-4380-809f-ff30414f55da.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251217130829_74fdfb9b-39eb-4b51-9d80-6d7cdf0b3ac9.sql
-- ------------------------------------------------------------
-- Fix material_requests SELECT policy to include supervisor (they may need to see team requests)
DROP POLICY IF EXISTS "Users can view their own requests" ON material_requests;

CREATE POLICY "Users can view material requests" 
ON material_requests FOR SELECT 
TO authenticated
USING (
  auth.uid() = requester_id OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- Allow supervisors to manage requests (update status for their team)
DROP POLICY IF EXISTS "Admins and analistas can manage requests" ON material_requests;

CREATE POLICY "Internal managers can manage requests" 
ON material_requests FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251217131505_cd4b2448-5638-42e9-bbcc-27006a6aa980.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251217132820_6124c661-50d4-4d1d-bdc2-c25ce02b8247.sql
-- ------------------------------------------------------------
-- Drop the old constraint
ALTER TABLE external_equipment_requests 
DROP CONSTRAINT external_equipment_requests_status_check;

-- Add new constraint with awaiting_pickup status
ALTER TABLE external_equipment_requests 
ADD CONSTRAINT external_equipment_requests_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'awaiting_pickup'::text, 'loaned'::text, 'returned'::text]));

-- ------------------------------------------------------------
-- 20251217133338_872a381b-cce5-4b0c-aca2-500eb3146dc8.sql
-- ------------------------------------------------------------
-- Add email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ------------------------------------------------------------
-- 20251217133739_b865d9b5-737d-4405-9081-94a99547eae7.sql
-- ------------------------------------------------------------
-- Add signature column to equipment_loans table for pickup signature
ALTER TABLE equipment_loans ADD COLUMN IF NOT EXISTS borrower_signature text;

-- ------------------------------------------------------------
-- 20251217134324_74b64fc2-978c-43fa-81d1-6b5d8d01b679.sql
-- ------------------------------------------------------------
-- Add return_signature column to equipment_loans table
ALTER TABLE public.equipment_loans 
ADD COLUMN return_signature text;

-- ------------------------------------------------------------
-- 20251217135048_29b54ad8-d0ef-461d-b87f-60113887e2b2.sql
-- ------------------------------------------------------------
-- Add borrower_signature column to locker_loans table
ALTER TABLE public.locker_loans 
ADD COLUMN borrower_signature text;

-- ------------------------------------------------------------
-- 20251217150355_afef436e-cd63-4fdd-a2c2-ba29e17905bb.sql
-- ------------------------------------------------------------
-- Allow external users to cancel their own reservations
CREATE POLICY "External users can cancel their own reservations" 
ON public.reservations 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND is_external = true 
  AND requester_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND is_external = true 
  AND status = 'cancelled'
);

-- ------------------------------------------------------------
-- 20251217194356_5f301f85-37e6-4b22-a36b-1057f7039d4f.sql
-- ------------------------------------------------------------
-- Add RLS policy to allow external users to view their own equipment requests
CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
USING (
  requester_email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )::text
);

-- ------------------------------------------------------------
-- 20251217200039_11249e55-7ce3-4780-91c2-4b89e7ba1d43.sql
-- ------------------------------------------------------------
-- Drop the existing policy
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;

-- Create updated policy with case-insensitive comparison
CREATE POLICY "External users can view their own equipment requests" 
ON public.external_equipment_requests 
FOR SELECT 
USING (
  lower(requester_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())::text)
);

-- ------------------------------------------------------------
-- 20251218115250_1e3ea54b-db1b-4a28-bed1-84303e52cdb3.sql
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 20251218135545_1d7f8141-991f-4942-a5b6-5681e933bbb4.sql
-- ------------------------------------------------------------
-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;
DROP POLICY IF EXISTS "Internal users can view external requests" ON public.external_equipment_requests;

-- Create permissive SELECT policies (OR logic instead of AND)
CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  lower(requester_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);

CREATE POLICY "Internal users can view all external requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'analista'::app_role) OR 
  has_role(auth.uid(), 'assistente'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ------------------------------------------------------------
-- 20251218151245_cde2729c-a5b5-48de-99be-9302c94e4ba1.sql
-- ------------------------------------------------------------
-- Fix RLS: avoid querying auth.users inside policies (can cause permission errors)
DROP POLICY IF EXISTS "External users can view their own equipment requests" ON public.external_equipment_requests;

CREATE POLICY "External users can view their own equipment requests"
ON public.external_equipment_requests
FOR SELECT
TO authenticated
USING (
  lower(requester_email) = lower(auth.email())
);

-- ------------------------------------------------------------
-- 20251218152938_1de9ce40-32da-4a59-862d-e53d48c29e2d.sql
-- ------------------------------------------------------------
-- Fix RLS policy for external users cancelling reservations
-- Use auth.email() directly instead of subquery to auth.users
DROP POLICY IF EXISTS "External users can cancel their own reservations" ON public.reservations;

CREATE POLICY "External users can cancel their own reservations" 
ON public.reservations 
FOR UPDATE 
TO authenticated
USING (
  is_external = true 
  AND lower(requester_email) = lower(auth.email())
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  is_external = true 
  AND status = 'cancelled'
);

-- ------------------------------------------------------------
-- 20251218153226_1fc251c1-20bb-4823-8c5c-2121fdda70f8.sql
-- ------------------------------------------------------------
-- Allow external users to cancel their own equipment requests
CREATE POLICY "External users can cancel their own equipment requests"
ON public.external_equipment_requests
FOR UPDATE
TO authenticated
USING (
  lower(requester_email) = lower(auth.email())
  AND status IN ('pending', 'approved', 'awaiting_pickup')
)
WITH CHECK (
  status = 'cancelled'
);

-- ------------------------------------------------------------
-- 20251218160653_62602bbb-4ed5-48e1-92ec-a6e89e0d0916.sql
-- ------------------------------------------------------------
-- Update RLS policy to allow external users to reschedule their equipment requests
DROP POLICY IF EXISTS "External users can cancel their own equipment requests" ON public.external_equipment_requests;

CREATE POLICY "External users can update their own equipment requests" 
ON public.external_equipment_requests 
FOR UPDATE 
USING (
  (lower(requester_email) = lower(auth.email())) 
  AND (status = ANY (ARRAY['pending'::text, 'approved'::text, 'awaiting_pickup'::text]))
)
WITH CHECK (
  (status = ANY (ARRAY['pending'::text, 'cancelled'::text]))
);

-- ------------------------------------------------------------
-- 20251219130357_ec4010a5-a621-400a-a5bd-3c01abc7fbdb.sql
-- ------------------------------------------------------------
-- Allow deletion of lost_items based on the app's permission system (instead of admin-only)

DROP POLICY IF EXISTS "Only admins can delete lost items" ON public.lost_items;

CREATE POLICY "Authorized users can delete lost items"
ON public.lost_items
FOR DELETE
USING (
  public.has_permission(auth.uid(), 'lostAndFound', 'delete')
);

-- ------------------------------------------------------------
-- 20251219131932_bd47594c-f557-4058-b179-5a5b16596d80.sql
-- ------------------------------------------------------------
-- Create archive table for delivered lost items (same structure as lost_items)
CREATE TABLE public.lost_items_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL,
    description text NOT NULL,
    image_url text,
    campus public.campus_enum NOT NULL,
    found_location text NOT NULL,
    found_date date NOT NULL,
    received_date date NOT NULL,
    delivered_by_name text NOT NULL,
    delivered_by_contact text,
    delivered_by_team_member uuid,
    owner_name text,
    owner_phone text,
    owner_email text,
    owner_signature text,
    status text NOT NULL DEFAULT 'delivered',
    delivered_at timestamp with time zone,
    registered_by uuid,
    shelf text,
    box text,
    seal_number text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    -- Archive metadata
    archived_at timestamp with time zone NOT NULL DEFAULT now(),
    archived_by uuid,
    archived_by_name text,
    original_id uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.lost_items_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for archive table
CREATE POLICY "Internal users can view archived items"
ON public.lost_items_archive
FOR SELECT
USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role) OR 
    has_role(auth.uid(), 'assistente'::app_role) OR 
    has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Admins and analistas can insert archived items"
ON public.lost_items_archive
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'analista'::app_role)
);

CREATE POLICY "Only admins can delete archived items"
ON public.lost_items_archive
FOR DELETE
USING (is_admin(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_lost_items_archive_archived_at ON public.lost_items_archive(archived_at DESC);
CREATE INDEX idx_lost_items_archive_code ON public.lost_items_archive(code);
CREATE INDEX idx_lost_items_archive_campus ON public.lost_items_archive(campus);

-- ------------------------------------------------------------
-- 20251221143255_32ef8279-d513-49b6-bd00-94a28e9ca844.sql
-- ------------------------------------------------------------
-- Enable pg_trgm extension for trigram search (faster ILIKE queries)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add indexes to improve lost_items query performance
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON public.lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_campus ON public.lost_items(campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_received_date ON public.lost_items(received_date);
CREATE INDEX IF NOT EXISTS idx_lost_items_created_at ON public.lost_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_items_code ON public.lost_items(code);
CREATE INDEX IF NOT EXISTS idx_lost_items_owner_name ON public.lost_items(owner_name);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_lost_items_status_campus ON public.lost_items(status, campus);
CREATE INDEX IF NOT EXISTS idx_lost_items_status_created_at ON public.lost_items(status, created_at DESC);

-- Trigram index for faster ILIKE searches
CREATE INDEX IF NOT EXISTS idx_lost_items_code_trgm ON public.lost_items USING gin(code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_description_trgm ON public.lost_items USING gin(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lost_items_found_location_trgm ON public.lost_items USING gin(found_location gin_trgm_ops);

-- Add index to profiles table for email lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Add index to external_users for email lookup
CREATE INDEX IF NOT EXISTS idx_external_users_email ON public.external_users(email);

-- ------------------------------------------------------------
-- 20251231204651_a24f2777-cf92-4722-9d5c-2df2b20c15a9.sql
-- ------------------------------------------------------------
-- Set REPLICA IDENTITY FULL for better change tracking on lost_items
ALTER TABLE public.lost_items REPLICA IDENTITY FULL;

-- ------------------------------------------------------------
-- 20260119132319_36b23a17-73fa-4eb9-b978-7408ae3c973d.sql
-- ------------------------------------------------------------
-- Add box_number column to lost_items table
ALTER TABLE public.lost_items ADD COLUMN IF NOT EXISTS box_number text;

-- Add box_number column to lost_items_archive table
ALTER TABLE public.lost_items_archive ADD COLUMN IF NOT EXISTS box_number text;

-- Add force_password_change column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;

-- ------------------------------------------------------------
-- 20260206124146_0ad8ce2f-d730-4748-b7c1-b7beb4edcdc1.sql
-- ------------------------------------------------------------

-- Add new fields to equipment_loans to match paper forms
ALTER TABLE public.equipment_loans
  ADD COLUMN IF NOT EXISTS borrower_type text DEFAULT 'aluno',
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS authorizer_name text,
  ADD COLUMN IF NOT EXISTS authorizer_contact text,
  ADD COLUMN IF NOT EXISTS collaborator_name text,
  ADD COLUMN IF NOT EXISTS return_collaborator_name text,
  ADD COLUMN IF NOT EXISTS returner_name text,
  ADD COLUMN IF NOT EXISTS returner_phone text,
  ADD COLUMN IF NOT EXISTS item_condition text,
  ADD COLUMN IF NOT EXISTS all_items_returned boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_items_description text;

-- ------------------------------------------------------------
-- 20260206133738_c2317e9c-6e2d-4189-9906-2d970d5cb99c.sql
-- ------------------------------------------------------------

-- Create shift handovers table
CREATE TABLE public.shift_handovers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift TEXT NOT NULL, -- Manhã, Tarde, Noite
  day_of_week TEXT NOT NULL, -- Segunda, Terça, etc.
  handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sector TEXT NOT NULL DEFAULT 'Recursos Didáticos',
  unit TEXT NOT NULL DEFAULT 'FCM Unidade I',
  has_impact_incident BOOLEAN NOT NULL DEFAULT false,
  general_observations TEXT,
  collaborator_name TEXT NOT NULL,
  collaborator_time TEXT NOT NULL,
  filled_by UUID NOT NULL,
  filled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift handover tasks table (checklist items)
CREATE TABLE public.shift_handover_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  answer BOOLEAN NOT NULL DEFAULT false,
  observation TEXT
);

-- Create shift handover incidents table
CREATE TABLE public.shift_handover_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handover_id UUID NOT NULL REFERENCES public.shift_handovers(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  description TEXT,
  location TEXT
);

-- Enable RLS
ALTER TABLE public.shift_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_handover_incidents ENABLE ROW LEVEL SECURITY;

-- Policies for shift_handovers
CREATE POLICY "Authenticated users can view shift handovers"
  ON public.shift_handovers FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handovers"
  ON public.shift_handovers FOR INSERT
  WITH CHECK (auth.uid() = filled_by);

CREATE POLICY "Only admins can delete shift handovers"
  ON public.shift_handovers FOR DELETE
  USING (is_admin(auth.uid()));

-- Policies for shift_handover_tasks
CREATE POLICY "Authenticated users can view shift handover tasks"
  ON public.shift_handover_tasks FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handover tasks"
  ON public.shift_handover_tasks FOR INSERT
  WITH CHECK (true);

-- Policies for shift_handover_incidents
CREATE POLICY "Authenticated users can view shift handover incidents"
  ON public.shift_handover_incidents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert shift handover incidents"
  ON public.shift_handover_incidents FOR INSERT
  WITH CHECK (true);

-- ------------------------------------------------------------
-- 20260206133813_473a686b-5de3-4af3-9965-df23d15f5b0c.sql
-- ------------------------------------------------------------

-- Fix overly permissive INSERT policies on shift_handover_tasks and shift_handover_incidents
-- They should only allow inserts when the user owns the parent handover

DROP POLICY "Authenticated users can insert shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Authenticated users can insert shift handover tasks"
  ON public.shift_handover_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shift_handovers
      WHERE id = handover_id AND filled_by = auth.uid()
    )
  );

DROP POLICY "Authenticated users can insert shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Authenticated users can insert shift handover incidents"
  ON public.shift_handover_incidents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shift_handovers
      WHERE id = handover_id AND filled_by = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 20260206150538_d74ed77a-31a7-463f-9967-9ccf5ed33841.sql
-- ------------------------------------------------------------

ALTER TABLE public.shift_handover_incidents
ADD COLUMN treatment text DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260206161207_6ab292ed-1003-4ae2-90bb-a2892ac857f6.sql
-- ------------------------------------------------------------

-- Create equipment_reservations table for pre-scheduling
CREATE TABLE public.equipment_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  quantity_reserved INTEGER NOT NULL DEFAULT 1,
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  requester_sector TEXT NOT NULL,
  requester_type TEXT NOT NULL DEFAULT 'aluno',
  purpose TEXT,
  scheduled_pickup_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_pickup',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_reservations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Internal users can view equipment reservations"
ON public.equipment_reservations
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can insert equipment reservations"
ON public.equipment_reservations
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Internal users can update equipment reservations"
ON public.equipment_reservations
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'analista'::app_role) OR
  has_role(auth.uid(), 'assistente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Only admins can delete equipment reservations"
ON public.equipment_reservations
FOR DELETE
USING (is_admin(auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.equipment_reservations;

-- ------------------------------------------------------------
-- 20260224130121_d0b02a42-516f-4ead-a753-d228e18a7a85.sql
-- ------------------------------------------------------------

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view their submitted call by ID" ON public.classroom_calls;

-- Add a scoped policy: only recent calls (last 30 minutes) are visible to non-internal users
-- This allows the classroom call form's real-time subscription to work
-- while preventing full table enumeration
CREATE POLICY "Recent calls visible for real-time updates"
ON public.classroom_calls FOR SELECT
USING (
  -- Internal users can see everything (covered by existing policy)
  -- Non-internal/anonymous users can only see calls created in the last 30 minutes
  created_at > NOW() - INTERVAL '30 minutes'
  AND status IN ('pending', 'accepted')
);

-- ------------------------------------------------------------
-- 20260224162528_871bf305-e10e-4b71-8fa1-51082d9b9648.sql
-- ------------------------------------------------------------
-- Fix 1: Restrict app_settings SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read settings" ON public.app_settings
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 2: Restrict shift_handovers SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handovers" ON public.shift_handovers;
CREATE POLICY "Authenticated users can view shift handovers" ON public.shift_handovers
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 3: Restrict shift_handover_tasks SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Fix 4: Restrict shift_handover_incidents SELECT to authenticated users
DROP POLICY IF EXISTS "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents
FOR SELECT USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- 20260224182754_a10a6af9-b10f-43b1-aaac-949bd2e580e9.sql
-- ------------------------------------------------------------
-- Add 'visualizador' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'visualizador';

-- ------------------------------------------------------------
-- 20260225164636_b680b4fb-8dcd-4fe7-9f39-39cb0ea79dfa.sql
-- ------------------------------------------------------------
-- Fix overly permissive INSERT RLS policies flagged by scanner
DROP POLICY IF EXISTS "Authenticated users can insert checklist answers" ON public.checklist_answers;
CREATE POLICY "Authenticated users can insert checklist answers"
ON public.checklist_answers
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can create external equipment requests" ON public.external_equipment_requests;
CREATE POLICY "Anyone can create external equipment requests"
ON public.external_equipment_requests
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert logs" ON public.reservation_logs;
CREATE POLICY "System can insert logs"
ON public.reservation_logs
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR has_role(auth.uid(), 'analista'::public.app_role)
  OR has_role(auth.uid(), 'assistente'::public.app_role)
  OR has_role(auth.uid(), 'supervisor'::public.app_role)
);

-- Move pg_trgm extension out of public schema (scanner warning)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ------------------------------------------------------------
-- 20260302180721_966b575f-8ebe-4633-9d59-24268233e2b4.sql
-- ------------------------------------------------------------
-- Change lost items expiration from 90 days to 60 days
CREATE OR REPLACE FUNCTION public.expire_old_lost_items()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.lost_items
    SET status = 'expired', updated_at = now()
    WHERE status = 'available'
      AND received_date < CURRENT_DATE - INTERVAL '60 days';
END;
$$;

-- ------------------------------------------------------------
-- 20260303194841_d7609af2-9d59-4756-8357-fe87a52f1b00.sql
-- ------------------------------------------------------------

-- Add event datetime columns to tasks table for "acompanhamento" category
ALTER TABLE public.tasks ADD COLUMN event_start_datetime timestamp with time zone DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN event_end_datetime timestamp with time zone DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260309184151_3577d968-71e3-461f-8fee-d1d9b38a2150.sql
-- ------------------------------------------------------------
ALTER TABLE public.equipment_reservations ADD COLUMN expected_return_date date;

-- ------------------------------------------------------------
-- 20260311192759_cba53c17-2e8b-42a2-b779-e53777f8b59e.sql
-- ------------------------------------------------------------
-- Enforce task creator integrity at database level
CREATE OR REPLACE FUNCTION public.enforce_task_creator_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_email text;
BEGIN
  -- Keep creator immutable after creation
  IF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    RETURN NEW;
  END IF;

  -- On insert, bind creator to authenticated user when available
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();

    SELECT p.full_name, p.email
      INTO v_full_name, v_email
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
    ORDER BY p.created_at DESC
    LIMIT 1;

    NEW.created_by_name := COALESCE(v_full_name, v_email, NEW.created_by_name, 'Sistema');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_creator_fields ON public.tasks;
CREATE TRIGGER trg_enforce_task_creator_fields
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_creator_fields();

-- ------------------------------------------------------------
-- 20260316130140_44af8aad-4b81-4887-918c-c580a002a73b.sql
-- ------------------------------------------------------------

-- Table for classroom call rooms (managed by admin)
CREATE TABLE public.classroom_call_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campus text NOT NULL DEFAULT 'Campus I',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for issues/problems linked to rooms
CREATE TABLE public.classroom_call_room_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.classroom_call_rooms(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Table for pre-defined response messages (used when accepting calls)
CREATE TABLE public.classroom_call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add response_message column to classroom_calls
ALTER TABLE public.classroom_calls ADD COLUMN response_message text;

-- Enable RLS
ALTER TABLE public.classroom_call_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_room_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_call_responses ENABLE ROW LEVEL SECURITY;

-- RLS for classroom_call_rooms
CREATE POLICY "Anyone can view active rooms" ON public.classroom_call_rooms
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage rooms" ON public.classroom_call_rooms
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- RLS for classroom_call_room_issues
CREATE POLICY "Anyone can view active issues" ON public.classroom_call_room_issues
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage issues" ON public.classroom_call_room_issues
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- RLS for classroom_call_responses
CREATE POLICY "Anyone can view active responses" ON public.classroom_call_responses
  FOR SELECT USING (is_active = true OR is_internal_user(auth.uid()));

CREATE POLICY "Internal users can manage responses" ON public.classroom_call_responses
  FOR ALL USING (is_admin_or_analista(auth.uid()));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_room_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_call_responses;

-- ------------------------------------------------------------
-- 20260316131900_013c4a20-f6d5-4ec6-8e31-bc0c32e6e3cc.sql
-- ------------------------------------------------------------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendente';

-- ------------------------------------------------------------
-- 20260316131917_faaa5fbb-b931-4666-9a48-4f2115295d7c.sql
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 20260316134322_28c23e51-8bbd-4d68-9a5e-922502aee933.sql
-- ------------------------------------------------------------

-- Allow anonymous/public inserts to classroom_calls (external form)
CREATE POLICY "Anyone can create classroom calls from external form"
ON public.classroom_calls
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ------------------------------------------------------------
-- 20260316152956_c7c71c91-4c00-4990-9021-61a15adda09d.sql
-- ------------------------------------------------------------
ALTER TABLE public.tasks ADD COLUMN recurrence_type text DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260316163409_e0623bbe-9cef-4ab3-a76e-2c1bf2d65536.sql
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 20260316174204_f76f0d03-2896-4046-bd94-1b19115d37b4.sql
-- ------------------------------------------------------------
ALTER TABLE public.classroom_calls ADD COLUMN campus text;

-- ------------------------------------------------------------
-- 20260316195021_ef1ab9eb-13d8-49f3-9f77-cd50abc67af8.sql
-- ------------------------------------------------------------

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated users to view task attachments
CREATE POLICY "Anyone can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');

-- Add attachment_urls column to task_comments for file references
ALTER TABLE public.task_comments ADD COLUMN attachment_urls text[] DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260317175416_3952c996-b1aa-4b53-aa9f-5b2c1f9eb8ac.sql
-- ------------------------------------------------------------
-- Update the tasks UPDATE RLS policy to also allow team members to update
DROP POLICY IF EXISTS "Admins or assigned users can update tasks" ON public.tasks;

CREATE POLICY "Admins or assigned users can update tasks"
ON public.tasks
FOR UPDATE
TO public
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR (assigned_to = auth.uid()) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_team_members 
    WHERE task_team_members.task_id = tasks.id 
    AND task_team_members.user_id = auth.uid()
  )
)
WITH CHECK (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'supervisor'::app_role) 
  OR (assigned_to = auth.uid()) 
  OR (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task_team_members 
    WHERE task_team_members.task_id = tasks.id 
    AND task_team_members.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- 20260317180805_8e14f77a-4dcb-4084-a59e-17d2791d4d77.sql
-- ------------------------------------------------------------
DO $$
DECLARE
  tables_to_add text[] := ARRAY[
    'locker_exchanges','lost_items_archive','classroom_call_rooms','classroom_call_responses',
    'classroom_call_room_issues','task_comments','task_team_members','task_history',
    'rooms','room_checklists','checklist_questions','checklist_answers',
    'shift_handovers','shift_handover_tasks','shift_handover_incidents',
    'reservations','reservation_rooms','inventory_movements','activity_logs','app_settings'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_add LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 20260320210552_aebbc4da-b8d8-4495-adb3-b130796b9ae4.sql
-- ------------------------------------------------------------
ALTER TABLE public.equipment_reservations ADD COLUMN reservation_group_id uuid DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260323162901_a4f3e14e-9b7d-43be-8d4b-22c9da0d1092.sql
-- ------------------------------------------------------------
ALTER TABLE public.equipment_loans ADD COLUMN loan_group_id uuid DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260324194325_e2b60efa-bd33-41ed-ab0e-9182005d5560.sql
-- ------------------------------------------------------------
ALTER TABLE public.equipment ADD COLUMN old_patrimony_code text DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260326131723_59014fe7-1dca-4309-8d8a-346cab94ad40.sql
-- ------------------------------------------------------------

-- Allow anonymous users to view reservations (for public board)
CREATE POLICY "Anyone can view reservations publicly"
ON public.reservations FOR SELECT
TO anon
USING (status IN ('pending', 'confirmed'));

-- Allow anonymous users to view reservation rooms (for public board)
CREATE POLICY "Anyone can view active reservation rooms"
ON public.reservation_rooms FOR SELECT
TO anon
USING (is_active = true);

-- ------------------------------------------------------------
-- 20260327122946_09c5879e-0e43-49a2-af75-639fa62f4678.sql
-- ------------------------------------------------------------

-- Allow admins to delete checklist answers
CREATE POLICY "Admins can delete checklist answers"
ON public.checklist_answers FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- Allow admins to delete room checklists
CREATE POLICY "Admins can delete room checklists"
ON public.room_checklists FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 20260520184027_5ec0ede4-fc93-4f43-bc81-6f6aa3ffc68e.sql
-- ------------------------------------------------------------
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS recurrence_days text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_last_run_date date DEFAULT NULL;

-- ------------------------------------------------------------
-- 20260603163415_0a8a6d1c-08a2-41a7-936b-881309b3c69d.sql
-- ------------------------------------------------------------

ALTER TABLE public.reservation_rooms
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS equipment jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.external_users
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

UPDATE public.external_users SET approval_status = 'approved' WHERE approval_status = 'pending' AND created_at < now() - interval '1 minute';

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS original_reservation_id uuid;

GRANT SELECT ON public.reservation_rooms TO anon, authenticated;
GRANT ALL ON public.reservation_rooms TO service_role;

DROP POLICY IF EXISTS "Only admins can change approval_status" ON public.external_users;
CREATE POLICY "Only admins can change approval_status"
  ON public.external_users
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analista'::app_role));

CREATE INDEX IF NOT EXISTS idx_external_users_approval_status ON public.external_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_reservations_original ON public.reservations(original_reservation_id);

-- ------------------------------------------------------------
-- 20260612151119_2d69c7a6-c7a3-4080-a5b4-b287e2f15f95.sql
-- ------------------------------------------------------------

-- 1. activity_logs: INSERT policy already exists (auth.uid() IS NOT NULL). Tighten to internal roles for cleanliness.
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.activity_logs;
CREATE POLICY "Internal users can insert activity logs"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role) OR
  public.has_role(auth.uid(),'analista'::app_role) OR
  public.has_role(auth.uid(),'assistente'::app_role) OR
  public.has_role(auth.uid(),'supervisor'::app_role) OR
  public.has_role(auth.uid(),'visualizador'::app_role) OR
  public.has_role(auth.uid(),'atendente'::app_role)
);

-- 2. reservation_reschedulings: restrict SELECT to authenticated only (was "true" for public role)
DROP POLICY IF EXISTS "Authenticated users can view reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Authenticated users can view reschedulings"
ON public.reservation_reschedulings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- 3. reservations: remove PII exposure to anon. Drop anon SELECT policy, create a SECURITY DEFINER RPC
--    that returns only non-PII fields for the public board.
DROP POLICY IF EXISTS "Anyone can view reservations publicly" ON public.reservations;

CREATE OR REPLACE FUNCTION public.get_public_reservations(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  id uuid,
  title text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  status text,
  attendees_count integer,
  room_id uuid,
  description text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, start_datetime, end_datetime, status, attendees_count, room_id, description, notes
  FROM public.reservations
  WHERE status IN ('pending','confirmed')
    AND start_datetime >= p_start
    AND start_datetime <= p_end;
$$;

REVOKE ALL ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) TO anon, authenticated;

-- 4. Storage: lost-items DELETE/UPDATE restricted to internal roles
DROP POLICY IF EXISTS "Authenticated users can delete lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update lost item images" ON storage.objects;

CREATE POLICY "Internal users can delete lost item images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lost-items' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

CREATE POLICY "Internal users can update lost item images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'lost-items' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

-- 5. Storage: task-attachments DELETE restricted to internal roles
DROP POLICY IF EXISTS "Users can delete task attachments" ON storage.objects;
CREATE POLICY "Internal users can delete task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND (
    public.has_role(auth.uid(),'admin'::app_role) OR
    public.has_role(auth.uid(),'analista'::app_role) OR
    public.has_role(auth.uid(),'assistente'::app_role) OR
    public.has_role(auth.uid(),'supervisor'::app_role)
  )
);

-- 6. Revoke EXECUTE from anon on SECURITY DEFINER functions that should not be publicly callable.
--    RLS helpers (has_role, is_admin, has_permission, is_admin_or_analista, is_internal_user) remain
--    executable since they are used inside policies and need to be evaluable.
REVOKE EXECUTE ON FUNCTION public.expire_old_lost_items() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_task_creator_fields() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM anon;

-- ------------------------------------------------------------
-- 20260617234439_818d999a-148c-4c2c-bf19-294d7e3e5eee.sql
-- ------------------------------------------------------------
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS import_tag text;
CREATE INDEX IF NOT EXISTS idx_reservations_import_tag ON public.reservations(import_tag) WHERE import_tag IS NOT NULL;

-- ------------------------------------------------------------
-- 20260625135312_310e618e-ec7d-4e09-99f1-8c0bdc1c083f.sql
-- ------------------------------------------------------------

-- ENUMS
CREATE TYPE public.semester_competency_status AS ENUM ('draft','released','blocked','finished');
CREATE TYPE public.semester_item_status AS ENUM ('pending_analysis','pending_ticket','ticket_opened','in_maintenance','waiting_parts','completed','written_off','cancelled');
CREATE TYPE public.semester_maintenance_type AS ENUM ('internal','external');

-- ============ COMPETENCIES ============
CREATE TABLE public.semester_competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.semester_competency_status NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_competencies TO authenticated;
GRANT ALL ON public.semester_competencies TO service_role;
ALTER TABLE public.semester_competencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view competencies" ON public.semester_competencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage competencies" ON public.semester_competencies
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_competencies_updated
  BEFORE UPDATE ON public.semester_competencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHECKLISTS ============
CREATE TABLE public.semester_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES public.semester_competencies(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.reservation_rooms(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  room_code text,
  campus text,
  floor text,
  responsible_id uuid,
  responsible_name text NOT NULL,
  checklist_date date NOT NULL DEFAULT CURRENT_DATE,
  general_observation text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_checklists_competency ON public.semester_checklists(competency_id);
CREATE INDEX idx_semester_checklists_room ON public.semester_checklists(room_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_checklists TO authenticated;
GRANT ALL ON public.semester_checklists TO service_role;
ALTER TABLE public.semester_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view checklists" ON public.semester_checklists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert checklists when released" ON public.semester_checklists
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_competencies c
      WHERE c.id = competency_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update checklists" ON public.semester_checklists
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete checklists" ON public.semester_checklists
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_checklists_updated
  BEFORE UPDATE ON public.semester_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHECKLIST ITEMS ============
CREATE TABLE public.semester_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.semester_checklists(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  observation text,
  maintenance_type public.semester_maintenance_type,
  needs_ticket boolean NOT NULL DEFAULT false,
  needs_label boolean NOT NULL DEFAULT false,
  photo_url text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  ticket_number text,
  ticket_opened_at timestamptz,
  ticket_responsible text,
  maintenance_done_at timestamptz,
  closure_observation text,
  closure_responsible text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_items_checklist ON public.semester_checklist_items(checklist_id);
CREATE INDEX idx_semester_items_status ON public.semester_checklist_items(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_checklist_items TO authenticated;
GRANT ALL ON public.semester_checklist_items TO service_role;
ALTER TABLE public.semester_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view items" ON public.semester_checklist_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert items when released" ON public.semester_checklist_items
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = checklist_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update items" ON public.semester_checklist_items
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete items" ON public.semester_checklist_items
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_items_updated
  BEFORE UPDATE ON public.semester_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FURNITURE DETAILS ============
CREATE TABLE public.semester_furniture_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.semester_checklist_items(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  problem_type text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  maintenance_type public.semester_maintenance_type,
  observation text,
  status public.semester_item_status NOT NULL DEFAULT 'pending_analysis',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_furniture_item ON public.semester_furniture_details(checklist_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_furniture_details TO authenticated;
GRANT ALL ON public.semester_furniture_details TO service_role;
ALTER TABLE public.semester_furniture_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view furniture" ON public.semester_furniture_details
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert furniture when released" ON public.semester_furniture_details
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklist_items i
      JOIN public.semester_checklists ch ON ch.id = i.checklist_id
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE i.id = checklist_item_id AND c.status = 'released'
    )
  );

CREATE POLICY "admin update furniture" ON public.semester_furniture_details
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin delete furniture" ON public.semester_furniture_details
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_semester_furniture_updated
  BEFORE UPDATE ON public.semester_furniture_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LABELS ============
CREATE TABLE public.semester_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid REFERENCES public.semester_checklist_items(id) ON DELETE CASCADE,
  furniture_detail_id uuid REFERENCES public.semester_furniture_details(id) ON DELETE CASCADE,
  competency_id uuid REFERENCES public.semester_competencies(id) ON DELETE CASCADE,
  label_code text NOT NULL UNIQUE,
  sequence_number int NOT NULL,
  sequence_total int NOT NULL,
  generated_by uuid,
  generated_by_name text,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_semester_labels_competency ON public.semester_labels(competency_id);
CREATE INDEX idx_semester_labels_item ON public.semester_labels(checklist_item_id);
CREATE INDEX idx_semester_labels_furniture ON public.semester_labels(furniture_detail_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_labels TO authenticated;
GRANT ALL ON public.semester_labels TO service_role;
ALTER TABLE public.semester_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view labels" ON public.semester_labels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert labels" ON public.semester_labels
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "admin delete labels" ON public.semester_labels
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 20260625153609_b56c29a4-f519-4a06-ba24-e14b30ee955b.sql
-- ------------------------------------------------------------
CREATE TABLE public.semester_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_item_options TO authenticated;
GRANT ALL ON public.semester_item_options TO service_role;

ALTER TABLE public.semester_item_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view options"
  ON public.semester_item_options FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage options - insert"
  ON public.semester_item_options FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage options - update"
  ON public.semester_item_options FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage options - delete"
  ON public.semester_item_options FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_semester_item_options_updated_at
  BEFORE UPDATE ON public.semester_item_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_semester_item_options_category ON public.semester_item_options(category, sort_order);

-- ------------------------------------------------------------
-- 20260630131530_efe6d86f-2ce9-4236-bc9f-2b8dcee33c45.sql
-- ------------------------------------------------------------
ALTER TABLE public.semester_checklists ADD COLUMN IF NOT EXISTS confirmed_categories text[] NOT NULL DEFAULT '{}'::text[];

-- ------------------------------------------------------------
-- 20260706134814_dcfb751c-6945-4d00-b373-86d0e7ae56ad.sql
-- ------------------------------------------------------------

CREATE TABLE public.semester_projectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.semester_checklists(id) ON DELETE CASCADE,
  patrimony text,
  model text,
  lamp_hours integer,
  actions text[] NOT NULL DEFAULT '{}'::text[],
  others_text text,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_projectors TO authenticated;
GRANT ALL ON public.semester_projectors TO service_role;

ALTER TABLE public.semester_projectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth view projectors" ON public.semester_projectors
  FOR SELECT USING (true);

CREATE POLICY "auth insert projectors when released" ON public.semester_projectors
  FOR INSERT WITH CHECK (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = semester_projectors.checklist_id
        AND c.status = 'released'::semester_competency_status
    )
  );

CREATE POLICY "auth update projectors when released" ON public.semester_projectors
  FOR UPDATE USING (
    is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.semester_checklists ch
      JOIN public.semester_competencies c ON c.id = ch.competency_id
      WHERE ch.id = semester_projectors.checklist_id
        AND c.status = 'released'::semester_competency_status
    )
  );

CREATE POLICY "admin delete projectors" ON public.semester_projectors
  FOR DELETE USING (is_admin(auth.uid()));

CREATE TRIGGER trg_semester_projectors_updated
BEFORE UPDATE ON public.semester_projectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_semester_projectors_checklist ON public.semester_projectors(checklist_id);

-- ------------------------------------------------------------
-- 20260706135949_05b51e60-c100-4778-8470-10118da81f14.sql
-- ------------------------------------------------------------

-- Add creator, filler and projector-confirmation tracking to semester_checklists
ALTER TABLE public.semester_checklists
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS filled_by_id uuid,
  ADD COLUMN IF NOT EXISTS filled_by_name text,
  ADD COLUMN IF NOT EXISTS filled_at timestamptz,
  ADD COLUMN IF NOT EXISTS projectors_confirmed boolean NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 20260731155433_619de3ce-c40f-499f-8b43-493f41a6f551.sql
-- ------------------------------------------------------------
CREATE TABLE public.uber_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  requester_name text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  trip_date date NOT NULL,
  trip_time text NOT NULL,
  reason text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'registrada',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.uber_requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uber_requests TO authenticated;
GRANT ALL ON public.uber_requests TO service_role;

ALTER TABLE public.uber_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create uber requests"
ON public.uber_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view uber requests"
ON public.uber_requests FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update uber requests"
ON public.uber_requests FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete uber requests"
ON public.uber_requests FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_uber_requests_created_at ON public.uber_requests (created_at DESC);

CREATE TRIGGER update_uber_requests_updated_at
BEFORE UPDATE ON public.uber_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20260804183051_f8d11d37-2beb-44f5-b26a-5f309f682ed5.sql
-- ------------------------------------------------------------

-- ROLES
CREATE TABLE public.ps_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  pay_value numeric NOT NULL DEFAULT 0,
  combined_roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_roles TO authenticated;
GRANT SELECT ON public.ps_roles TO anon;
GRANT ALL ON public.ps_roles TO service_role;
ALTER TABLE public.ps_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_roles internal manage" ON public.ps_roles FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_roles public read" ON public.ps_roles FOR SELECT TO anon USING (true);

-- COLLABORATORS
CREATE TABLE public.ps_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  cpf text,
  matricula text,
  email text,
  phone text,
  role text,
  unit text,
  sector text,
  position text,
  journey text,
  pcd text NOT NULL DEFAULT 'NORMAL',
  city text,
  state text,
  pix text,
  total_events integer NOT NULL DEFAULT 0,
  average_rating numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_collaborators TO authenticated;
GRANT ALL ON public.ps_collaborators TO service_role;
ALTER TABLE public.ps_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_collaborators internal manage" ON public.ps_collaborators FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- EVENTS
CREATE TABLE public.ps_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  location text,
  description text,
  status text NOT NULL DEFAULT 'planejamento',
  coordinator_name text,
  notes text,
  hidden_from_evaluation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_events TO authenticated;
GRANT SELECT ON public.ps_events TO anon;
GRANT ALL ON public.ps_events TO service_role;
ALTER TABLE public.ps_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_events internal manage" ON public.ps_events FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_events public read" ON public.ps_events FOR SELECT TO anon USING (true);

-- EVENT COLLABORATORS
CREATE TABLE public.ps_event_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_name text NOT NULL,
  assigned_role text,
  sector text,
  campus text,
  evaluated boolean NOT NULL DEFAULT false,
  absent boolean NOT NULL DEFAULT false,
  signature_url text,
  signed_at timestamptz,
  signature_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_event_collaborators TO authenticated;
GRANT SELECT, UPDATE ON public.ps_event_collaborators TO anon;
GRANT ALL ON public.ps_event_collaborators TO service_role;
ALTER TABLE public.ps_event_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evcol internal manage" ON public.ps_event_collaborators FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evcol public read" ON public.ps_event_collaborators FOR SELECT TO anon USING (true);
CREATE POLICY "ps_evcol public update" ON public.ps_event_collaborators FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- CAMPUSES
CREATE TABLE public.ps_campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_campuses TO authenticated;
GRANT SELECT ON public.ps_campuses TO anon;
GRANT ALL ON public.ps_campuses TO service_role;
ALTER TABLE public.ps_campuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_campuses internal manage" ON public.ps_campuses FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_campuses public read" ON public.ps_campuses FOR SELECT TO anon USING (true);

CREATE TABLE public.ps_campus_floors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id uuid REFERENCES public.ps_campuses(id) ON DELETE CASCADE,
  campus_name text,
  name text NOT NULL,
  rooms text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_campus_floors TO authenticated;
GRANT SELECT ON public.ps_campus_floors TO anon;
GRANT ALL ON public.ps_campus_floors TO service_role;
ALTER TABLE public.ps_campus_floors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_floors internal manage" ON public.ps_campus_floors FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_floors public read" ON public.ps_campus_floors FOR SELECT TO anon USING (true);

-- CANDIDATES
CREATE TABLE public.ps_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  registration_number text,
  cpf text,
  rg text,
  room text,
  campus text,
  exam_type text,
  seat_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_candidates TO authenticated;
GRANT ALL ON public.ps_candidates TO service_role;
ALTER TABLE public.ps_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_candidates internal manage" ON public.ps_candidates FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- EVALUATIONS
CREATE TABLE public.ps_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  assigned_role text NOT NULL DEFAULT '',
  collaborator_name text,
  sector text,
  punctuality integer NOT NULL DEFAULT 0,
  domain integer NOT NULL DEFAULT 0,
  room_control integer NOT NULL DEFAULT 0,
  attention_vigilance integer NOT NULL DEFAULT 0,
  professional_posture integer NOT NULL DEFAULT 0,
  communication integer NOT NULL DEFAULT 0,
  organization integer NOT NULL DEFAULT 0,
  incident_management integer NOT NULL DEFAULT 0,
  teamwork integer NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  classification text,
  observations text,
  evaluator_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluations TO authenticated;
GRANT SELECT, INSERT ON public.ps_evaluations TO anon;
GRANT ALL ON public.ps_evaluations TO service_role;
ALTER TABLE public.ps_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_evaluations internal manage" ON public.ps_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_evaluations public read" ON public.ps_evaluations FOR SELECT TO anon USING (true);
CREATE POLICY "ps_evaluations public insert" ON public.ps_evaluations FOR INSERT TO anon WITH CHECK (true);

-- GENERAL EVALUATIONS
CREATE TABLE public.ps_general_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name text NOT NULL,
  evaluator_name text NOT NULL,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  collaborator_name text NOT NULL,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_role text,
  collaborator_position text,
  punctuality integer NOT NULL DEFAULT 0,
  domain integer NOT NULL DEFAULT 0,
  room_control integer NOT NULL DEFAULT 0,
  attention_vigilance integer NOT NULL DEFAULT 0,
  professional_posture integer NOT NULL DEFAULT 0,
  communication integer NOT NULL DEFAULT 0,
  organization integer NOT NULL DEFAULT 0,
  incident_management integer NOT NULL DEFAULT 0,
  teamwork integer NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  classification text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_general_evaluations TO authenticated;
GRANT ALL ON public.ps_general_evaluations TO service_role;
ALTER TABLE public.ps_general_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_gen_eval internal manage" ON public.ps_general_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- SELF EVALUATIONS
CREATE TABLE public.ps_self_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.ps_events(id) ON DELETE CASCADE,
  respondent_name text,
  identified boolean NOT NULL DEFAULT false,
  role text,
  training_rating integer,
  training_comment text,
  organization_rating integer,
  organization_comment text,
  snack_rating integer,
  snack_comment text,
  partner_fiscal_rating integer,
  partner_fiscal_comment text,
  had_incident boolean NOT NULL DEFAULT false,
  incident_comment text,
  suggestions text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_self_evaluations TO authenticated;
GRANT INSERT ON public.ps_self_evaluations TO anon;
GRANT ALL ON public.ps_self_evaluations TO service_role;
ALTER TABLE public.ps_self_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_self_eval internal manage" ON public.ps_self_evaluations FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_self_eval public insert" ON public.ps_self_evaluations FOR INSERT TO anon WITH CHECK (true);

-- RETIFICATIONS
CREATE TABLE public.ps_evaluation_retifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ps_events(id) ON DELETE CASCADE,
  evaluation_id uuid NOT NULL REFERENCES public.ps_evaluations(id) ON DELETE CASCADE,
  collaborator_id uuid REFERENCES public.ps_collaborators(id) ON DELETE SET NULL,
  collaborator_name text,
  requested_by text NOT NULL,
  criteria text[] NOT NULL DEFAULT '{}',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  coordinator_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_evaluation_retifications TO authenticated;
GRANT INSERT ON public.ps_evaluation_retifications TO anon;
GRANT ALL ON public.ps_evaluation_retifications TO service_role;
ALTER TABLE public.ps_evaluation_retifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_retif internal manage" ON public.ps_evaluation_retifications FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_retif public insert" ON public.ps_evaluation_retifications FOR INSERT TO anon WITH CHECK (true);

-- FISCAL BANK
CREATE TABLE public.ps_fiscal_bank_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome_completo text NOT NULL,
  telefone_contato text NOT NULL,
  instituto text NOT NULL,
  setor text NOT NULL,
  dominio_ingles text,
  habilidades_ingles text[] NOT NULL DEFAULT '{}',
  leitura_portugues text,
  escrita_portugues text,
  letra_legivel text,
  agilidade_digitacao text,
  funcoes_com_conforto text[] NOT NULL DEFAULT '{}',
  datas_disponibilidade text[] NOT NULL DEFAULT '{}',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_fiscal_bank_applications TO authenticated;
GRANT INSERT ON public.ps_fiscal_bank_applications TO anon;
GRANT ALL ON public.ps_fiscal_bank_applications TO service_role;
ALTER TABLE public.ps_fiscal_bank_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_fb_app internal manage" ON public.ps_fiscal_bank_applications FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_fb_app public insert" ON public.ps_fiscal_bank_applications FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE public.ps_fiscal_bank_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datas text[] NOT NULL DEFAULT '{}',
  data_indisponivel_label text NOT NULL DEFAULT 'Não tenho disponibilidade',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ps_fiscal_bank_config TO authenticated;
GRANT SELECT ON public.ps_fiscal_bank_config TO anon;
GRANT ALL ON public.ps_fiscal_bank_config TO service_role;
ALTER TABLE public.ps_fiscal_bank_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_fb_cfg internal manage" ON public.ps_fiscal_bank_config FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));
CREATE POLICY "ps_fb_cfg public read" ON public.ps_fiscal_bank_config FOR SELECT TO anon USING (true);

-- updated_at triggers
CREATE TRIGGER ps_roles_updated BEFORE UPDATE ON public.ps_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_collaborators_updated BEFORE UPDATE ON public.ps_collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_events_updated BEFORE UPDATE ON public.ps_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_evcol_updated BEFORE UPDATE ON public.ps_event_collaborators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_evaluations_updated BEFORE UPDATE ON public.ps_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_gen_eval_updated BEFORE UPDATE ON public.ps_general_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_retif_updated BEFORE UPDATE ON public.ps_evaluation_retifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ps_fb_cfg_updated BEFORE UPDATE ON public.ps_fiscal_bank_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 20260806124437_d2ef8a05-403b-44e6-932f-c7e0a1090eff.sql
-- ------------------------------------------------------------
ALTER TABLE public.ps_collaborators
  ADD COLUMN IF NOT EXISTS identity_doc text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS preferred_role text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.ps_event_collaborators
  ADD COLUMN IF NOT EXISTS role_value text,
  ADD COLUMN IF NOT EXISTS role_name text,
  ADD COLUMN IF NOT EXISTS pay_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS present boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS identity_doc text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS deposit_info text,
  ADD COLUMN IF NOT EXISTS pix text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS import_tag text;

CREATE UNIQUE INDEX IF NOT EXISTS ps_collaborators_cpf_unique
  ON public.ps_collaborators (cpf) WHERE cpf IS NOT NULL AND cpf <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ps_event_collaborators_event_collab_unique
  ON public.ps_event_collaborators (event_id, collaborator_id) WHERE collaborator_id IS NOT NULL;

-- ------------------------------------------------------------
-- 20260807184718_3a7bdc45-3b4d-46fc-9d28-89f836a0b093.sql
-- ------------------------------------------------------------
ALTER TABLE public.ps_candidates
  ADD COLUMN IF NOT EXISTS process_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS barcode text;

-- ------------------------------------------------------------
-- 20260807224433_faef1fd8-3fba-4aea-8551-6076f7dee884.sql
-- ------------------------------------------------------------
-- ============ ps_event_collaborators ============
DROP POLICY IF EXISTS "ps_evcol public read" ON public.ps_event_collaborators;
DROP POLICY IF EXISTS "ps_evcol public update" ON public.ps_event_collaborators;
REVOKE ALL ON public.ps_event_collaborators FROM anon;

CREATE OR REPLACE FUNCTION public.ps_public_event_roster(p_event_id uuid)
RETURNS TABLE(id uuid, collaborator_id uuid, collaborator_name text, assigned_role text, role_name text, sector text, signed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ec.id, ec.collaborator_id, ec.collaborator_name, ec.assigned_role, ec.role_name, ec.sector, ec.signed_at
  FROM public.ps_event_collaborators ec
  JOIN public.ps_events e ON e.id = ec.event_id
  WHERE ec.event_id = p_event_id
    AND COALESCE(e.hidden_from_evaluation, false) = false
  ORDER BY ec.collaborator_name;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.ps_public_sign_attendance(p_link_id uuid, p_signature text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_signature IS NULL OR length(p_signature) < 50 OR length(p_signature) > 500000 THEN
    RAISE EXCEPTION 'Assinatura inválida';
  END IF;
  UPDATE public.ps_event_collaborators ec
  SET signature_url = p_signature, signed_at = now()
  WHERE ec.id = p_link_id
    AND ec.signed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = ec.event_id AND COALESCE(e.hidden_from_evaluation,false) = false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado ou já assinado';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated;

-- ============ ps_evaluations ============
DROP POLICY IF EXISTS "ps_evaluations public read" ON public.ps_evaluations;
DROP POLICY IF EXISTS "ps_evaluations public insert" ON public.ps_evaluations;
REVOKE ALL ON public.ps_evaluations FROM anon;

CREATE OR REPLACE FUNCTION public.ps_public_submit_evaluation(
  p_event_id uuid,
  p_link_id uuid,
  p_assigned_role text,
  p_evaluator_name text,
  p_observations text,
  p_criteria jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_link public.ps_event_collaborators%ROWTYPE;
  v_keys text[] := ARRAY['punctuality','domain','room_control','attention_vigilance','professional_posture','communication','organization','incident_management','teamwork'];
  k text;
  v int;
  v_sum numeric := 0;
  v_score numeric;
  v_class text;
  v_id uuid;
BEGIN
  IF coalesce(trim(p_evaluator_name),'') = '' THEN
    RAISE EXCEPTION 'Informe o nome do avaliador';
  END IF;

  SELECT * INTO v_link FROM public.ps_event_collaborators
  WHERE id = p_link_id AND event_id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fiscal não encontrado neste evento';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = p_event_id AND COALESCE(e.hidden_from_evaluation,false) = false) THEN
    RAISE EXCEPTION 'Evento não disponível para avaliação';
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    v := (p_criteria ->> k)::int;
    IF v IS NULL OR v < 1 OR v > 5 THEN
      RAISE EXCEPTION 'Critério inválido: %', k;
    END IF;
    v_sum := v_sum + v;
  END LOOP;

  v_score := round((v_sum / array_length(v_keys,1))::numeric, 2);
  v_class := CASE
    WHEN v_score >= 4.5 THEN 'excelente'
    WHEN v_score >= 3.5 THEN 'bom'
    WHEN v_score >= 2.5 THEN 'regular'
    ELSE 'insuficiente'
  END;

  INSERT INTO public.ps_evaluations (
    event_id, collaborator_id, collaborator_name, sector, assigned_role,
    evaluator_name, observations,
    punctuality, domain, room_control, attention_vigilance, professional_posture,
    communication, organization, incident_management, teamwork,
    final_score, classification
  ) VALUES (
    p_event_id, v_link.collaborator_id, v_link.collaborator_name, v_link.sector,
    COALESCE(NULLIF(trim(p_assigned_role),''), v_link.assigned_role, 'fiscal_sala'),
    left(trim(p_evaluator_name), 200), left(NULLIF(trim(coalesce(p_observations,'')),''), 2000),
    (p_criteria->>'punctuality')::int, (p_criteria->>'domain')::int, (p_criteria->>'room_control')::int,
    (p_criteria->>'attention_vigilance')::int, (p_criteria->>'professional_posture')::int,
    (p_criteria->>'communication')::int, (p_criteria->>'organization')::int,
    (p_criteria->>'incident_management')::int, (p_criteria->>'teamwork')::int,
    v_score, v_class
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated;

-- ============ ps_self_evaluations ============
DROP POLICY IF EXISTS "ps_self_eval public insert" ON public.ps_self_evaluations;
CREATE POLICY "ps_self_eval public insert validated"
ON public.ps_self_evaluations FOR INSERT TO anon
WITH CHECK (
  EXISTS (SELECT 1 FROM public.ps_events e WHERE e.id = event_id AND COALESCE(e.hidden_from_evaluation,false) = false)
  AND (identified = false OR coalesce(length(trim(respondent_name)),0) BETWEEN 2 AND 200)
  AND (training_rating IS NULL OR training_rating BETWEEN 1 AND 5)
  AND (organization_rating IS NULL OR organization_rating BETWEEN 1 AND 5)
  AND (snack_rating IS NULL OR snack_rating BETWEEN 1 AND 5)
  AND (partner_fiscal_rating IS NULL OR partner_fiscal_rating BETWEEN 1 AND 5)
  AND coalesce(length(suggestions),0) <= 4000
  AND coalesce(length(incident_comment),0) <= 4000
  AND coalesce(length(training_comment),0) <= 4000
  AND coalesce(length(organization_comment),0) <= 4000
  AND coalesce(length(snack_comment),0) <= 4000
  AND coalesce(length(partner_fiscal_comment),0) <= 4000
);

-- ============ ps_evaluation_retifications ============
DROP POLICY IF EXISTS "ps_retif public insert" ON public.ps_evaluation_retifications;
CREATE POLICY "ps_retif public insert validated"
ON public.ps_evaluation_retifications FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ps_evaluations ev
    WHERE ev.id = evaluation_id
      AND ev.event_id = ps_evaluation_retifications.event_id
      AND ev.collaborator_id = ps_evaluation_retifications.collaborator_id
  )
  AND coalesce(length(trim(reason)),0) BETWEEN 5 AND 4000
  AND coalesce(length(requested_by),0) <= 200
  AND status = 'pendente'
);

-- ============ classroom_calls ============
DROP POLICY IF EXISTS "Recent calls visible for real-time updates" ON public.classroom_calls;
DROP POLICY IF EXISTS "Anyone can create classroom calls from external form" ON public.classroom_calls;
REVOKE ALL ON public.classroom_calls FROM anon;

CREATE OR REPLACE FUNCTION public.create_public_classroom_call(p_room_name text, p_reason text, p_campus text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(trim(p_room_name),'') = '' THEN
    RAISE EXCEPTION 'Sala obrigatória';
  END IF;
  INSERT INTO public.classroom_calls (room_name, reason, status, campus)
  VALUES (left(trim(p_room_name), 200), left(coalesce(trim(p_reason),''), 1000), 'pending', left(coalesce(trim(p_campus),''), 100))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_classroom_call_status(p_id uuid)
RETURNS TABLE(status text, accepted_by_name text, accepted_at timestamptz, response_message text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.status, c.accepted_by_name, c.accepted_at, c.response_message
  FROM public.classroom_calls c
  WHERE c.id = p_id AND c.created_at > now() - interval '6 hours';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) TO anon, authenticated;

-- ------------------------------------------------------------
-- 20260807225211_a2f409d4-5198-449f-92a3-6d370ade7814.sql
-- ------------------------------------------------------------
-- 1) Remove implicit PUBLIC execute on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) FROM PUBLIC;

-- helpers no client should call directly
REVOKE EXECUTE ON FUNCTION public.get_linked_rooms(uuid) FROM anon, authenticated;

-- room availability is used by the signed-in app only
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon;

-- role predicates are only needed by anon while evaluating anon-visible policies,
-- which are scoped to authenticated below; revoke anon execute
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM anon;

-- 2) Scope internal-management policies on anon-readable tables to authenticated
DROP POLICY IF EXISTS "Internal users can manage rooms" ON public.classroom_call_rooms;
CREATE POLICY "Internal users can manage rooms" ON public.classroom_call_rooms
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can manage issues" ON public.classroom_call_room_issues;
CREATE POLICY "Internal users can manage issues" ON public.classroom_call_room_issues
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can manage responses" ON public.classroom_call_responses;
CREATE POLICY "Internal users can manage responses" ON public.classroom_call_responses
  FOR ALL TO authenticated
  USING (public.is_internal_user(auth.uid()))
  WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Admins and analistas can manage rooms" ON public.reservation_rooms;
CREATE POLICY "Admins and analistas can manage rooms" ON public.reservation_rooms
  FOR ALL TO authenticated
  USING (public.is_admin_or_analista(auth.uid()))
  WITH CHECK (public.is_admin_or_analista(auth.uid()));

-- 3) Realtime channel authorization: only internal staff may use realtime channels
DROP POLICY IF EXISTS "Internal users can receive realtime messages" ON realtime.messages;
CREATE POLICY "Internal users can receive realtime messages" ON realtime.messages
  FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Internal users can send realtime messages" ON realtime.messages;
CREATE POLICY "Internal users can send realtime messages" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user(auth.uid()));

-- 4) Storage: no broad object listing on public buckets
DROP POLICY IF EXISTS "Authenticated users can view lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;

CREATE POLICY "Internal users can read task attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can read lost item images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));

-- ------------------------------------------------------------
-- 20260807225845_92106a73-5236-499a-af1d-d5b044c99597.sql
-- ------------------------------------------------------------

-- reservations: internal staff see all; external portal users only their own
DROP POLICY IF EXISTS "Authenticated users can view reservations" ON public.reservations;
CREATE POLICY "Internal staff or owner can view reservations"
ON public.reservations FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR requester_email = auth.email()
  OR created_by = auth.uid()
);

-- reservation_reschedulings
DROP POLICY IF EXISTS "Authenticated users can view reschedulings" ON public.reservation_reschedulings;
CREATE POLICY "Internal staff or owner can view reschedulings"
ON public.reservation_reschedulings FOR SELECT TO authenticated
USING (
  public.is_internal_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_reschedulings.reservation_id
      AND (r.requester_email = auth.email() OR r.created_by = auth.uid())
  )
);

-- tasks and related
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
CREATE POLICY "Internal staff can view tasks"
ON public.tasks FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view comments" ON public.task_comments;
CREATE POLICY "Internal staff can view task comments"
ON public.task_comments FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view task history" ON public.task_history;
CREATE POLICY "Internal staff can view task history"
ON public.task_history FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view task team members" ON public.task_team_members;
CREATE POLICY "Internal staff can view task team members"
ON public.task_team_members FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- checklists
DROP POLICY IF EXISTS "Authenticated users can view room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can view room checklists"
ON public.room_checklists FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can view checklist answers"
ON public.checklist_answers FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view checklist questions" ON public.checklist_questions;
CREATE POLICY "Internal staff can view checklist questions"
ON public.checklist_questions FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- semester projectors
DROP POLICY IF EXISTS "auth view projectors" ON public.semester_projectors;
CREATE POLICY "Internal staff can view projectors"
ON public.semester_projectors FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- inventory
DROP POLICY IF EXISTS "Authenticated users can view equipment" ON public.equipment;
CREATE POLICY "Internal staff can view equipment"
ON public.equipment FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view lockers" ON public.lockers;
CREATE POLICY "Internal staff can view lockers"
ON public.lockers FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view rooms" ON public.rooms;
CREATE POLICY "Internal staff can view rooms"
ON public.rooms FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- settings and permission matrix
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;
CREATE POLICY "Internal staff can read settings"
ON public.app_settings FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.role_permissions;
CREATE POLICY "Internal staff can view permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_internal_user(auth.uid()));

-- ------------------------------------------------------------
-- 20260807230036_e7ddcb32-5ed6-4062-b096-7b5464a16648.sql
-- ------------------------------------------------------------

REVOKE ALL ON FUNCTION public.ps_public_sign_attendance(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 20260807232452_ea34dc3a-8506-4075-a9fc-7d62b05d33be.sql
-- ------------------------------------------------------------
-- Revoke broad EXECUTE from anon/public on all SECURITY DEFINER helpers
REVOKE ALL ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) FROM anon, public;
REVOKE ALL ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_linked_rooms(uuid) FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_admin_or_analista(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_internal_user(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.expire_old_lost_items() FROM anon, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;
REVOKE ALL ON FUNCTION public.enforce_task_creator_fields() FROM anon, public, authenticated;

-- Keep internal helpers usable by signed-in users (needed by RLS policies and app queries)
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reservation_conflict(uuid, timestamptz, timestamptz, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_rooms(timestamptz, timestamptz, integer, campus_enum, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_analista(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_lost_items() TO authenticated;

-- Explicitly keep the intentionally public endpoints callable by anonymous visitors
GRANT EXECUTE ON FUNCTION public.create_public_classroom_call(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_classroom_call_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reservations(timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_event_roster(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_sign_attendance(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ps_public_submit_evaluation(uuid, uuid, text, text, text, jsonb) TO anon, authenticated;

-- service_role keeps full access for edge functions / cron
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ------------------------------------------------------------
-- 20260807232930_527b96d5-1821-473c-b839-981a168c7749.sql
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ps_events public read" ON public.ps_events;
DROP POLICY IF EXISTS "ps_roles public read" ON public.ps_roles;
REVOKE SELECT ON public.ps_events FROM anon;
REVOKE SELECT ON public.ps_roles FROM anon;

DROP POLICY IF EXISTS "Authenticated users can upload lost item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;

CREATE POLICY "Internal users can upload lost item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lost-items' AND public.is_internal_user(auth.uid()));

CREATE POLICY "Internal users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND public.is_internal_user(auth.uid()));

-- ------------------------------------------------------------
-- 20260807233245_6852756e-cf70-4971-ae30-21b1d74ae9ed.sql
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.expire_old_lost_items() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_lost_items() TO service_role;

-- ------------------------------------------------------------
-- 20260807233555_8406321a-6b45-4a35-8d1e-8deae5ff1e4f.sql
-- ------------------------------------------------------------
-- Semester module: restrict reads to internal staff
DROP POLICY IF EXISTS "auth view items" ON public.semester_checklist_items;
CREATE POLICY "internal view items" ON public.semester_checklist_items
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view checklists" ON public.semester_checklists;
CREATE POLICY "internal view checklists" ON public.semester_checklists
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view competencies" ON public.semester_competencies;
CREATE POLICY "internal view competencies" ON public.semester_competencies
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view furniture" ON public.semester_furniture_details;
CREATE POLICY "internal view furniture" ON public.semester_furniture_details
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view options" ON public.semester_item_options;
CREATE POLICY "Internal staff can view options" ON public.semester_item_options
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth view labels" ON public.semester_labels;
CREATE POLICY "internal view labels" ON public.semester_labels
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "auth insert labels" ON public.semester_labels;
CREATE POLICY "internal insert labels" ON public.semester_labels
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

-- Room combinations: internal staff only (public pages use SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Anyone can view room combinations" ON public.room_combinations;
CREATE POLICY "Internal staff can view room combinations" ON public.room_combinations
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
REVOKE SELECT ON public.room_combinations FROM anon;

-- Uber requests: internal staff only
DROP POLICY IF EXISTS "Anyone can create uber requests" ON public.uber_requests;
CREATE POLICY "Internal staff can create uber requests" ON public.uber_requests
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));
REVOKE ALL ON public.uber_requests FROM anon;

-- ------------------------------------------------------------
-- 20260807233634_296b7216-6ee3-42da-808f-02e62dee6082.sql
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "ps_fb_app public insert" ON public.ps_fiscal_bank_applications;
CREATE POLICY "ps_fb_app public insert validated"
ON public.ps_fiscal_bank_applications
FOR INSERT TO anon, authenticated
WITH CHECK (
  length(trim(nome_completo)) BETWEEN 2 AND 200
  AND length(trim(email)) BETWEEN 5 AND 255
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(trim(coalesce(telefone_contato,''))) BETWEEN 8 AND 30
  AND coalesce(length(instituto), 0) <= 200
  AND coalesce(length(setor), 0) <= 200
  AND coalesce(length(observacoes), 0) <= 4000
  AND coalesce(array_length(habilidades_ingles, 1), 0) <= 50
  AND coalesce(array_length(funcoes_com_conforto, 1), 0) <= 50
  AND coalesce(array_length(datas_disponibilidade, 1), 0) <= 100
);

-- ------------------------------------------------------------
-- 20260807233757_7ae2c5ea-204b-4433-83e7-951af4234f00.sql
-- ------------------------------------------------------------
-- Lost items: internal staff only
DROP POLICY IF EXISTS "Authenticated users can view lost items" ON public.lost_items;
CREATE POLICY "Internal staff can view lost items" ON public.lost_items
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

-- Tasks
DROP POLICY IF EXISTS "All authenticated users can create tasks" ON public.tasks;
CREATE POLICY "Internal staff can create tasks" ON public.tasks
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.task_comments;
CREATE POLICY "Internal staff can insert comments" ON public.task_comments
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "System can insert task history" ON public.task_history;
CREATE POLICY "Internal staff can insert task history" ON public.task_history
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

-- Checklists
DROP POLICY IF EXISTS "Authenticated users can insert checklist answers" ON public.checklist_answers;
CREATE POLICY "Internal staff can insert checklist answers" ON public.checklist_answers
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert room checklists" ON public.room_checklists;
CREATE POLICY "Internal staff can insert room checklists" ON public.room_checklists
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()) AND auth.uid() = filled_by);

-- Shift handovers
DROP POLICY IF EXISTS "Authenticated users can insert shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can insert shift handovers" ON public.shift_handovers
FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()) AND auth.uid() = filled_by);

DROP POLICY IF EXISTS "Authenticated users can view shift handovers" ON public.shift_handovers;
CREATE POLICY "Internal staff can view shift handovers" ON public.shift_handovers
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can view shift handover incidents" ON public.shift_handover_incidents
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert shift handover incidents" ON public.shift_handover_incidents;
CREATE POLICY "Internal staff can insert shift handover incidents" ON public.shift_handover_incidents
FOR INSERT TO authenticated WITH CHECK (
  public.is_internal_user(auth.uid())
  AND EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id AND h.filled_by = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can view shift handover tasks" ON public.shift_handover_tasks
FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert shift handover tasks" ON public.shift_handover_tasks;
CREATE POLICY "Internal staff can insert shift handover tasks" ON public.shift_handover_tasks
FOR INSERT TO authenticated WITH CHECK (
  public.is_internal_user(auth.uid())
  AND EXISTS (SELECT 1 FROM public.shift_handovers h WHERE h.id = handover_id AND h.filled_by = auth.uid())
);

-- ------------------------------------------------------------
-- 20260808012822_6ef49cb6-6067-45a1-bfac-2e3f006528f2.sql
-- ------------------------------------------------------------

-- Anon-facing read policies must not call internal role helper functions
-- (anon has no EXECUTE on is_internal_user), which broke the public form.

DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.classroom_call_rooms;
CREATE POLICY "Public can view active rooms"
  ON public.classroom_call_rooms FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view rooms"
  ON public.classroom_call_rooms FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active issues" ON public.classroom_call_room_issues;
CREATE POLICY "Public can view active issues"
  ON public.classroom_call_room_issues FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view issues"
  ON public.classroom_call_room_issues FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active responses" ON public.classroom_call_responses;
CREATE POLICY "Public can view active responses"
  ON public.classroom_call_responses FOR SELECT TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view responses"
  ON public.classroom_call_responses FOR SELECT TO authenticated
  USING (is_active = true OR public.is_internal_user(auth.uid()));

GRANT SELECT ON public.classroom_call_rooms TO anon;
GRANT SELECT ON public.classroom_call_room_issues TO anon;
GRANT SELECT ON public.classroom_call_responses TO anon;

-- ------------------------------------------------------------
-- 20260808012952_28fc8187-dbd5-4518-8e8d-70b7fc9b910d.sql
-- ------------------------------------------------------------
DELETE FROM public.classroom_calls WHERE room_name = 'TESTE DIAG' AND reason = 'teste diagnostico';

-- ------------------------------------------------------------
-- 20260810203912_184193c6-abef-49f2-9e7a-fb060b17b253.sql
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_uber_request(
  p_requester_name text,
  p_origin text,
  p_destination text,
  p_trip_date date,
  p_trip_time time,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(id uuid, code text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
BEGIN
  IF coalesce(trim(p_requester_name),'') = '' OR coalesce(trim(p_origin),'') = ''
     OR coalesce(trim(p_destination),'') = '' OR coalesce(trim(p_reason),'') = ''
     OR p_trip_date IS NULL OR p_trip_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatórios';
  END IF;

  v_code := 'UBR-' || to_char(now(), 'YYYY') || '-' || upper(substr(md5(random()::text), 1, 5));

  RETURN QUERY
  INSERT INTO public.uber_requests (
    code, requester_name, origin, destination, trip_date, trip_time, reason, notes, status
  ) VALUES (
    v_code,
    left(trim(p_requester_name), 200),
    left(trim(p_origin), 300),
    left(trim(p_destination), 300),
    p_trip_date,
    p_trip_time,
    left(trim(p_reason), 1000),
    left(NULLIF(trim(coalesce(p_notes,'')),''), 1000),
    'registrada'
  )
  RETURNING uber_requests.id, uber_requests.code, uber_requests.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_uber_request(text, text, text, date, time, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_uber_request(text, text, text, date, time, text, text) TO anon, authenticated;
