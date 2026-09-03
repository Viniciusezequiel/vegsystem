-- Autoavaliação:
-- cargo e campus obrigatórios;
-- andar/sala opcionais;
-- comentários obrigatórios para notas 1 ou 2.

ALTER TABLE public.ps_self_evaluations
  ADD COLUMN IF NOT EXISTS campus text,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS room text;


-- NOT VALID preserva respostas antigas incompletas,
-- mas passa a validar novos INSERTs/UPDATEs.

ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_role_required;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_role_required
  CHECK (
    nullif(trim(coalesce(role, '')), '') IS NOT NULL
  ) NOT VALID;


ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_campus_required;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_campus_required
  CHECK (
    nullif(trim(coalesce(campus, '')), '') IS NOT NULL
  ) NOT VALID;


ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_training_low_rating_comment;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_training_low_rating_comment
  CHECK (
    training_rating IS NULL
    OR training_rating > 2
    OR nullif(trim(coalesce(training_comment, '')), '') IS NOT NULL
  ) NOT VALID;


ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_organization_low_rating_comment;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_organization_low_rating_comment
  CHECK (
    organization_rating IS NULL
    OR organization_rating > 2
    OR nullif(trim(coalesce(organization_comment, '')), '') IS NOT NULL
  ) NOT VALID;


ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_snack_low_rating_comment;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_snack_low_rating_comment
  CHECK (
    snack_rating IS NULL
    OR snack_rating > 2
    OR nullif(trim(coalesce(snack_comment, '')), '') IS NOT NULL
  ) NOT VALID;


ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_partner_low_rating_comment;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_partner_low_rating_comment
  CHECK (
    partner_fiscal_rating IS NULL
    OR partner_fiscal_rating > 2
    OR nullif(trim(coalesce(partner_fiscal_comment, '')), '') IS NOT NULL
  ) NOT VALID;


-- Garante faixa válida para novas respostas.
ALTER TABLE public.ps_self_evaluations
  DROP CONSTRAINT IF EXISTS ps_self_eval_rating_range;

ALTER TABLE public.ps_self_evaluations
  ADD CONSTRAINT ps_self_eval_rating_range
  CHECK (
    (training_rating IS NULL OR training_rating BETWEEN 1 AND 5)
    AND
    (organization_rating IS NULL OR organization_rating BETWEEN 1 AND 5)
    AND
    (snack_rating IS NULL OR snack_rating BETWEEN 1 AND 5)
    AND
    (partner_fiscal_rating IS NULL OR partner_fiscal_rating BETWEEN 1 AND 5)
  ) NOT VALID;
