-- ATIVAÇÃO DOS CRON JOBS NO DESTINO — RODAR SOMENTE NO MOMENTO DA VIRADA.
-- Pré-requisito obrigatório: os jobs equivalentes do backend antigo já devem
-- estar DESATIVADOS, senão as demandas recorrentes são criadas em duplicidade.
--
-- Passo 1 (no backend ANTIGO):
--   select cron.alter_job(jobid, active := false)
--   from cron.job
--   where jobname in ('expire-lost-items-daily','process-recurring-tasks-daily','process-recurring-tasks-hourly');
--
-- Passo 2 (aqui, no DESTINO):

-- Confere que os segredos do Vault existem antes de ativar
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'cron_service_role_key')
     or not exists (select 1 from vault.decrypted_secrets where name = 'recurring_tasks_cron_secret') then
    raise exception 'Segredos ausentes no Vault: rode a seção 1 de migracao/05-cron.sql antes de ativar';
  end if;
end $$;

select cron.alter_job(jobid, active := true)
from cron.job
where jobname in (
  'expire-lost-items-daily',
  'process-recurring-tasks-daily',
  'process-recurring-tasks-hourly'
);

select jobname, schedule, active from cron.job order by jobname;
