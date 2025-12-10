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