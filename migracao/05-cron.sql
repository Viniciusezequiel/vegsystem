-- Recria os agendamentos automáticos no projeto de destino (sshyjnyvihdheofjzsca).
-- IMPORTANTE: os jobs são criados DESATIVADOS (active = false) para não rodar em
-- paralelo com o backend atual (evita demandas recorrentes duplicadas).
-- Na virada, rode o bloco final "ATIVAÇÃO" depois de desativar os jobs da origem.
--
-- Substitua <SERVICE_ROLE_KEY> e <CRON_SECRET> antes de rodar.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Expiração de achados e perdidos com mais de 60 dias (de hora em hora, igual à origem)
select cron.unschedule('expire-lost-items-daily')
where exists (select 1 from cron.job where jobname = 'expire-lost-items-daily');

select cron.schedule(
  'expire-lost-items-daily',
  '0 * * * *',
  $$ select public.expire_old_lost_items(); $$
);

-- 2) Demandas recorrentes - execução diária (06:00 UTC = 03:00 BRT)
select cron.unschedule('process-recurring-tasks-daily')
where exists (select 1 from cron.job where jobname = 'process-recurring-tasks-daily');

select cron.schedule(
  'process-recurring-tasks-daily',
  '0 6 * * *',
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

-- 3) Demandas recorrentes - reforço horário (minuto 15)
select cron.unschedule('process-recurring-tasks-hourly')
where exists (select 1 from cron.job where jobname = 'process-recurring-tasks-hourly');

select cron.schedule(
  'process-recurring-tasks-hourly',
  '15 * * * *',
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

-- Deixa tudo DESATIVADO até a virada
update cron.job set active = false
where jobname in (
  'expire-lost-items-daily',
  'process-recurring-tasks-daily',
  'process-recurring-tasks-hourly'
);

-- Conferência
select jobname, schedule, active from cron.job order by jobname;

-- =====================================================================
-- ATIVAÇÃO (rodar SOMENTE no momento da virada, após desligar os jobs
-- do backend atual da Lovable):
--
-- update cron.job set active = true
-- where jobname in (
--   'expire-lost-items-daily',
--   'process-recurring-tasks-daily',
--   'process-recurring-tasks-hourly'
-- );
-- =====================================================================
