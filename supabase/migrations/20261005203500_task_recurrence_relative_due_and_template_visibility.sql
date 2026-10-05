alter table public.tasks
  add column if not exists recurrence_due_days smallint;

alter table public.tasks
  drop constraint if exists tasks_recurrence_due_days_check;

alter table public.tasks
  add constraint tasks_recurrence_due_days_check
  check (recurrence_due_days is null or recurrence_due_days between 0 and 30);

update public.tasks
set recurrence_due_days = case
  when recurrence_type = 'weekly'
    and due_date is not null
    and array_length(recurrence_days, 1) > 0
    then ((extract(dow from due_date)::integer - recurrence_days[1]::integer + 7) % 7)::smallint
  when due_date is not null then 0::smallint
  else null
end
where recurrence_type is not null
  and recurrence_due_days is null;

create or replace function public.sync_recurring_task_open_occurrences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  week_start timestamp without time zone;
  week_end timestamp without time zone;
begin
  if new.recurrence_type is null then
    return new;
  end if;

  week_start := date_trunc('week', now() at time zone 'America/Sao_Paulo');
  week_end := week_start + interval '7 days';

  update public.tasks child
  set
    title = new.title,
    description = new.description,
    priority = new.priority,
    category = new.category,
    assigned_to = new.assigned_to,
    assigned_to_name = new.assigned_to_name,
    estimated_hours = new.estimated_hours,
    tags = new.tags,
    notes = new.notes,
    due_date = case
      when new.recurrence_due_days is not null
        then ((child.created_at at time zone 'America/Sao_Paulo')::date + new.recurrence_due_days::integer)
      else child.due_date
    end,
    updated_at = now()
  where child.recurrence_parent_id = new.id
    and child.status in ('pending', 'in_progress', 'on_hold')
    and (child.created_at at time zone 'America/Sao_Paulo') >= week_start
    and (child.created_at at time zone 'America/Sao_Paulo') < week_end;

  return new;
end;
$$;

revoke all on function public.sync_recurring_task_open_occurrences() from public, anon, authenticated;

drop trigger if exists trg_sync_recurring_task_open_occurrences on public.tasks;
create trigger trg_sync_recurring_task_open_occurrences
after update of title, description, priority, category, assigned_to, assigned_to_name, estimated_hours, tags, notes, recurrence_due_days
on public.tasks
for each row
when (new.recurrence_type is not null)
execute function public.sync_recurring_task_open_occurrences();

drop policy if exists "Internal staff can view tasks" on public.tasks;
create policy "Internal staff can view tasks"
on public.tasks
for select
to authenticated
using (
  is_internal_user(auth.uid())
  and (recurrence_type is null or is_admin(auth.uid()))
);
