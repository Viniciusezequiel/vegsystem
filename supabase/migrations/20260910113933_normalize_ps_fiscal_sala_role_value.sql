DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.ps_roles WHERE value = 'fiscal_de_sala')
     AND NOT EXISTS (SELECT 1 FROM public.ps_roles WHERE value = 'fiscal_sala') THEN
    UPDATE public.ps_roles
    SET value = 'fiscal_sala', updated_at = now()
    WHERE value = 'fiscal_de_sala';
  END IF;
END $$;
