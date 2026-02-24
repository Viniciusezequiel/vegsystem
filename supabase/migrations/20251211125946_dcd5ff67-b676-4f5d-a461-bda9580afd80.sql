-- Add user_type and sector columns to external_users
ALTER TABLE public.external_users
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'professor',
ADD COLUMN IF NOT EXISTS sector text;

-- Add a check constraint for user_type
ALTER TABLE public.external_users
ADD CONSTRAINT external_users_user_type_check
CHECK (user_type IN ('professor', 'colaborador'));