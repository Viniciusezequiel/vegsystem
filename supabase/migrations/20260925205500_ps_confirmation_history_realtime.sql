-- Historico de confirmacoes do Processo Seletivo em Realtime.
-- Substitui polling periodico no frontend por invalidacao somente quando houver mudanca real.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ps_confirmation_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ps_confirmation_history;
  END IF;
END $$;
