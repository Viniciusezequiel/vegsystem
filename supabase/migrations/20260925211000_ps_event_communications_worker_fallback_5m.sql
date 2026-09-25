-- O enqueue e o worker encadeado continuam processando imediatamente.
-- Este cron e apenas uma rede de seguranca para retomar filas interrompidas,
-- portanto 5 minutos reduz significativamente ruido de pg_cron/log ingestion.
select cron.unschedule('ps-event-communications-auto-worker')
where exists (
  select 1
  from cron.job
  where jobname = 'ps-event-communications-auto-worker'
);

select cron.schedule(
  'ps-event-communications-auto-worker',
  '*/5 * * * *',
  $$ select public.invoke_ps_event_communications_worker(); $$
);
