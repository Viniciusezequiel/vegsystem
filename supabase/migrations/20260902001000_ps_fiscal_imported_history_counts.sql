ALTER TABLE public.ps_collaborators
  ADD COLUMN IF NOT EXISTS imported_selection_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.ps_collaborators
  ADD COLUMN IF NOT EXISTS imported_participation_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ps_collaborators.imported_selection_count IS
  'Histórico legado importado do Banco de Fiscais: número de seleções anteriores. Não deve ser somado automaticamente às atuações registradas no VEG.';

COMMENT ON COLUMN public.ps_collaborators.imported_participation_count IS
  'Histórico legado importado do Banco de Fiscais: número de participações em processos seletivos. Não deve ser somado automaticamente às atuações registradas no VEG.';
