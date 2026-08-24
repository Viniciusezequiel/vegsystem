-- Recria os agendamentos automáticos no projeto de destino (sshyjnyvihdheofjzsca).
-- Substitua <SERVICE_ROLE_KEY> e <CRON_SECRET> antes de rodar.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Expiração automática de achados e perdidos com mais de 60 dias (03:10 UTC = 00:10 BRT)
select cron.unschedule('expire-lost-items-daily')
where exists (select 1 from cron.job where jobname = 'expire-lost-items-daily');

select cron.schedule(
  'expire-lost-items-daily',
  '10 3 * * *',
  $$ select public.expire_old_lost_items(); $$
);

-- 2) Criação das demandas recorrentes (03:30 UTC = 00:30 BRT)
select cron.unschedule('process-recurring-tasks-daily')
where exists (select 1 from cron.job where jobname = 'process-recurring-tasks-daily');

select cron.schedule(
  'process-recurring-tasks-daily',
  '30 3 * * *',
  $$
  select net.http_post(
    url     := 'https://sshyjnyvihdheofjzsca.supabase.co/functions/v1/process-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferência
select jobname, schedule, active from cron.job order by jobname;
