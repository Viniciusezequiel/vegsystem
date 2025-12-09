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