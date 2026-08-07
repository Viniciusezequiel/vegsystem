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