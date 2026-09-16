-- Processamento automático da fila de comunicações do Processo Seletivo.
-- Reutiliza os segredos já mantidos no Supabase Vault; nenhum segredo fica
-- persistido no comando do cron.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

create or replace function public.invoke_ps_event_communications_worker()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $fn$
declare
  v_service_key text;
  v_cron_secret text;
  v_event_id uuid;
  v_today date := (now() at time zone 'UTC')::date;
begin
  select decrypted_secret into v_service_key
  from vault.decrypted_secrets
  where name = 'cron_service_role_key';

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets
  where name = 'recurring_tasks_cron_secret';

  if v_service_key is null or v_cron_secret is null then
    raise exception 'Segredos do cron ausentes no Vault (cron_service_role_key / recurring_tasks_cron_secret)';
  end if;

  for v_event_id in
    select distinct c.event_id
    from public.ps_event_communications c
    where c.status = 'pending'
       or (
         c.status = 'waiting_provider_quota'
         and (
           c.provider_quota_date is null
           or c.provider_quota_date < v_today
         )
       )
  loop
    perform net.http_post(
      url := 'https://sshyjnyvihdheofjzsca.supabase.co/functions/v1/ps-event-communications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key,
        'x-cron-secret', v_cron_secret
      ),
      body := jsonb_build_object(
        'action', 'process_queue_worker',
        'eventId', v_event_id
      )
    );
  end loop;
end;
$fn$;

revoke all on function public.invoke_ps_event_communications_worker() from public, anon, authenticated;

select cron.unschedule('ps-event-communications-auto-worker')
where exists (
  select 1
  from cron.job
  where jobname = 'ps-event-communications-auto-worker'
);

select cron.schedule(
  'ps-event-communications-auto-worker',
  '* * * * *',
  $$ select public.invoke_ps_event_communications_worker(); $$
);
