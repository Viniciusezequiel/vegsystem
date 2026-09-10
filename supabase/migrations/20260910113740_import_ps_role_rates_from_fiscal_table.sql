ALTER TABLE public.ps_roles
  ADD COLUMN IF NOT EXISTS pay_value_4h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_6h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_7h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_8h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_9h numeric,
  ADD COLUMN IF NOT EXISTS pay_value_integral numeric;

COMMENT ON COLUMN public.ps_roles.pay_value IS
  'Valor padrão do cargo; para a tabela de fiscais, corresponde ao valor de 8 horas quando disponível.';
COMMENT ON COLUMN public.ps_roles.pay_value_4h IS 'Valor praticado para jornada de 4 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_6h IS 'Valor praticado para jornada de 6 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_7h IS 'Valor praticado para jornada de 7 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_8h IS 'Valor praticado para jornada de 8 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_9h IS 'Valor praticado para jornada de 9 horas.';
COMMENT ON COLUMN public.ps_roles.pay_value_integral IS 'Valor praticado para horário integral (manhã e tarde).';

INSERT INTO public.ps_roles (
  name, value, active, "order", pay_value,
  pay_value_4h, pay_value_6h, pay_value_7h, pay_value_8h, pay_value_9h, pay_value_integral
)
VALUES
('Advogado(a)','advogado',TRUE,0,700,NULL,700,700,700,700,1100),
('Coordenador(a)','coordenador',TRUE,1,1000,NULL,1000,1000,1000,1000,1600),
('Copeira','copeira',TRUE,2,280,NULL,220,280,280,280,NULL),
('Enfermeiro(a)','enfermeiro',TRUE,3,300,NULL,220,280,300,320,NULL),
('Equipe de Apoio','apoio',TRUE,4,300,170,220,280,300,320,NULL),
('Fiscal de Organização','fiscal_de_organizacao',TRUE,5,120,120,120,120,120,120,NULL),
('Fiscal de Sala','fiscal_de_sala',TRUE,6,300,170,220,280,300,320,NULL),
('Fiscal de Sala Especial','fiscal_de_sala_especial',TRUE,7,332,220,260,310,332,354,NULL),
('Fiscal Detector de Metal','fiscal_detector_de_metal',TRUE,8,300,170,220,280,300,320,NULL),
('Fiscal Extra','fiscal_extra',TRUE,9,300,170,220,280,300,320,NULL),
('Fiscal Itinerante','fiscal_itinerante',TRUE,10,385,NULL,360,360,385,410,NULL),
('Fiscal Líder de Sala','fiscal_lider_de_sala',TRUE,11,321,200,250,300,321,342,NULL),
('Fiscal Sanitário','fiscal_sanitario',TRUE,12,300,170,220,280,300,320,NULL),
('Manutenção','manutencao',TRUE,13,300,170,220,280,300,320,NULL),
('Médico(a)','medico',TRUE,14,800,NULL,800,800,800,800,1200),
('Motorista','motorista',TRUE,15,300,NULL,220,280,300,320,NULL),
('Porteiro','porteiro',TRUE,16,300,NULL,220,280,300,320,NULL),
('Operador de Scanner','operador_de_scaner',TRUE,17,280,NULL,220,280,280,280,NULL),
('Subcoordenador','subcoordenador',TRUE,18,670,450,670,670,670,670,1040)
ON CONFLICT (value) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  "order" = EXCLUDED."order",
  pay_value = EXCLUDED.pay_value,
  pay_value_4h = EXCLUDED.pay_value_4h,
  pay_value_6h = EXCLUDED.pay_value_6h,
  pay_value_7h = EXCLUDED.pay_value_7h,
  pay_value_8h = EXCLUDED.pay_value_8h,
  pay_value_9h = EXCLUDED.pay_value_9h,
  pay_value_integral = EXCLUDED.pay_value_integral,
  updated_at = now();
