-- ATIVAÇÃO DOS CRON JOBS NO DESTINO — RODAR SOMENTE NO MOMENTO DA VIRADA.
-- Pré-requisito obrigatório: os jobs equivalentes do backend antigo já devem
-- estar DESATIVADOS, senão as demandas recorrentes são criadas em duplicidade.
--
-- Passo 1 (no backend ANTIGO): update cron.job set active = false
--   where jobname in ('expire-lost-items-daily','process-recurring-tasks-daily','process-recurring-tasks-hourly');
-- Passo 2 (aqui, no DESTINO):

update cron.job set active = true
where jobname in (
  'expire-lost-items-daily',
  'process-recurring-tasks-daily',
  'process-recurring-tasks-hourly'
);

select jobname, schedule, active from cron.job order by jobname;
