ALTER TABLE public.ps_roles
  ADD COLUMN IF NOT EXISTS pay_value_special_4h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_special_6h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_special_7h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_special_8h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_special_9h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_special_integral numeric;

COMMENT ON COLUMN public.ps_roles.pay_value_special_4h IS 'Valor do cargo no Setor Especial para jornada de 4 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_special_6h IS 'Valor do cargo no Setor Especial para jornada de 6 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_special_7h IS 'Valor do cargo no Setor Especial para jornada de 7 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_special_8h IS 'Valor do cargo no Setor Especial para jornada de 8 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_special_9h IS 'Valor do cargo no Setor Especial para jornada de 9 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_special_integral IS 'Valor do cargo no Setor Especial para horário integral.';

WITH special_rows AS (
  SELECT
    regexp_replace(value, '_setor_especial$', '') AS base_value,
    pay_value_4h,
    pay_value_6h,
    pay_value_7h,
    pay_value_8h,
    pay_value_9h,
    pay_value_integral
  FROM public.ps_roles
  WHERE value LIKE '%\_setor\_especial' ESCAPE '\'
)
UPDATE public.ps_roles base
SET
  pay_value_special_4h = special.pay_value_4h,
  pay_value_special_6h = special.pay_value_6h,
  pay_value_special_7h = special.pay_value_7h,
  pay_value_special_8h = special.pay_value_8h,
  pay_value_special_9h = special.pay_value_9h,
  pay_value_special_integral = special.pay_value_integral,
  updated_at = now()
FROM special_rows special
WHERE base.value = special.base_value;

DELETE FROM public.ps_roles
WHERE value LIKE '%\_setor\_especial' ESCAPE '\';
