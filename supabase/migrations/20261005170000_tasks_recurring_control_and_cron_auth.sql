alter table public.tasks
  add column if not exists recurrence_parent_id uuid references public.tasks(id) on delete set null;

create index if not exists tasks_recurrence_parent_id_idx
  on public.tasks(recurrence_parent_id);

update public.tasks child
set recurrence_parent_id = parent.id
from public.tasks parent
where child.recurrence_parent_id is null
  and child.recurrence_type is null
  and parent.recurrence_type is not null
  and child.id <> parent.id
  and lower(btrim(child.title)) = lower(btrim(parent.title))
  and child.assigned_to is not distinct from parent.assigned_to
  and not exists (
    select 1
    from public.tasks other
    where other.recurrence_type is not null
      and other.id <> parent.id
      and lower(btrim(other.title)) = lower(btrim(parent.title))
      and other.assigned_to is not distinct from parent.assigned_to
  );

create or replace function public.invoke_process_recurring_tasks()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $function$
declare
  v_cron_secret text;
begin
  select decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets
  where name = 'recurring_tasks_cron_secret';

  if v_cron_secret is null then
    raise exception 'Segredo do cron ausente no Vault';
  end if;

  perform net.http_post(
    url := 'https://sshyjnyvihdheofjzsca.supabase.co/functions/v1/process-recurring-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_cron_secret
    ),
    body := '{}'::jsonb
  );
end;
$function$;

revoke all on function public.invoke_process_recurring_tasks() from public;
revoke all on function public.invoke_process_recurring_tasks() from anon;
revoke all on function public.invoke_process_recurring_tasks() from authenticated;
