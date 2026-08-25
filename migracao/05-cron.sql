-- Recria os agendamentos automáticos no projeto de destino (sshyjnyvihdheofjzsca).
-- Os segredos NÃO ficam gravados no comando do cron: são guardados no Supabase Vault
-- e lidos em tempo de execução via vault.decrypted_secrets.
--
-- Os jobs são criados e mantidos DESATIVADOS (via cron.alter_job) para não rodar em
-- paralelo com o backend atual (evita demandas recorrentes duplicadas).
-- Na virada, rode migracao/05b-ativar-cron-na-virada.sql.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

-- =====================================================================
-- 1) SEGREDOS NO VAULT
-- Rode este bloco UMA VEZ, substituindo os valores. Depois de gravado,
-- apague os valores do seu histórico de SQL editor.
-- =====================================================================

-- Chave usada no header Authorization da chamada à Edge Function
-- (mesmo valor da service role key do projeto de destino).
select vault.create_secret(
  '<SERVICE_ROLE_KEY>',
  'cron_service_role_key',
  'Bearer token usado pelos cron jobs para chamar Edge Functions'
)
where not exists (select 1 from vault.secrets where name = 'cron_service_role_key');

-- Cópia segura do RECURRING_TASKS_CRON_SECRET (mesmo valor do Edge Function secret).
select vault.create_secret(
  '<CRON_SECRET>',
  'recurring_tasks_cron_secret',
  'Cópia no Vault do RECURRING_TASKS_CRON_SECRET usado pelo cron'
)
where not exists (select 1 from vault.secrets where name = 'recurring_tasks_cron_secret');

-- Para ATUALIZAR um valor já existente, use (não recria o segredo):
-- select vault.update_secret(
--   (select id from vault.secrets where name = 'cron_service_role_key'),
--   '<NOVO_VALOR>'
-- );

-- =====================================================================
-- 2) FUNÇÃO QUE DISPARA A EDGE FUNCTION LENDO OS SEGREDOS DO VAULT
-- O comando agendado no cron passa a ser apenas a chamada desta função,
-- sem nenhum segredo em texto claro em cron.job.
-- =====================================================================

create or replace function public.invoke_process_recurring_tasks()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $fn$
declare
  v_service_key text;
  v_cron_secret text;
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets where name = 'cron_service_role_key';

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets where name = 'recurring_tasks_cron_secret';

  if v_service_key is null or v_cron_secret is null then
    raise exception 'Segredos do cron ausentes no Vault (cron_service_role_key / recurring_tasks_cron_secret)';
  end if;

  perform net.http_post(
    url     := 'https://sshyjnyvihdheofjzsca.supabase.co/functions/v1/process-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'x-cron-secret', v_cron_secret
    ),
    body    := '{}'::jsonb
  );
end;
$fn$;

revoke all on function public.invoke_process_recurring_tasks() from public, anon, authenticated;

-- =====================================================================
-- 3) AGENDAMENTOS (frequências idênticas às da origem)
-- =====================================================================

select cron.unschedule('expire-lost-items-daily')
where exists (select 1 from cron.job where jobname = 'expire-lost-items-daily');

select cron.schedule(
  'expire-lost-items-daily',
  '0 * * * *',
  $$ select public.expire_old_lost_items(); $$
);

select cron.unschedule('process-recurring-tasks-daily')
where exists (select 1 from cron.job where jobname = 'process-recurring-tasks-daily');

select cron.schedule(
  'process-recurring-tasks-daily',
  '0 6 * * *',
  $$ select public.invoke_process_recurring_tasks(); $$
);

select cron.unschedule('process-recurring-tasks-hourly')
where exists (select 1 from cron.job where jobname = 'process-recurring-tasks-hourly');

select cron.schedule(
  'process-recurring-tasks-hourly',
  '15 * * * *',
  $$ select public.invoke_process_recurring_tasks(); $$
);

-- =====================================================================
-- 4) MANTER TUDO DESATIVADO ATÉ A VIRADA (API oficial do pg_cron)
-- =====================================================================

select cron.alter_job(jobid, active := false)
from cron.job
where jobname in (
  'expire-lost-items-daily',
  'process-recurring-tasks-daily',
  'process-recurring-tasks-hourly'
);

-- Conferência (nenhum segredo deve aparecer em "command")
select jobname, schedule, active, command from cron.job order by jobname;
