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