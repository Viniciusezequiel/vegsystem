alter table public.ps_collaborators
  add column if not exists inactive_reason_category text,
  add column if not exists inactive_reason text,
  add column if not exists inactivated_at timestamptz,
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null,
  add column if not exists inactivated_by_name text;

create table if not exists public.ps_collaborator_status_history (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.ps_collaborators(id) on delete cascade,
  active boolean not null,
  reason_category text,
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ps_collaborator_status_history_collaborator_created
  on public.ps_collaborator_status_history (collaborator_id, created_at desc);

alter table public.ps_collaborator_status_history enable row level security;

drop policy if exists "ps_collaborator_status_history internal read" on public.ps_collaborator_status_history;
create policy "ps_collaborator_status_history internal read"
  on public.ps_collaborator_status_history
  for select
  to authenticated
  using ((select public.is_internal_user((select auth.uid()))));

grant select on public.ps_collaborator_status_history to authenticated;
grant all on public.ps_collaborator_status_history to service_role;

create or replace function public.ps_validate_collaborator_active_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.active is distinct from new.active and new.active = false then
    if new.inactive_reason_category not in (
      'medical_leave', 'terminated', 'unavailable', 'duplicate_or_incorrect', 'other'
    ) then
      raise exception 'Selecione um motivo válido para inativar o colaborador.';
    end if;

    if length(trim(coalesce(new.inactive_reason, ''))) < 3 then
      raise exception 'Informe uma justificativa para inativar o colaborador.';
    end if;

    if new.inactivated_at is null or new.inactivated_by is null then
      raise exception 'A inativação deve ser realizada pelo fluxo auditável.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ps_validate_collaborator_active_change on public.ps_collaborators;
create trigger trg_ps_validate_collaborator_active_change
  before update of active on public.ps_collaborators
  for each row
  execute function public.ps_validate_collaborator_active_change();

revoke all on function public.ps_validate_collaborator_active_change() from public, anon, authenticated;

create or replace function public.ps_set_collaborator_active(
  p_collaborator_id uuid,
  p_active boolean,
  p_reason_category text default null,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_active boolean;
  v_actor_name text;
begin
  if auth.uid() is null or not public.is_internal_user(auth.uid()) then
    raise exception 'Acesso negado.';
  end if;

  select active
    into v_current_active
    from public.ps_collaborators
   where id = p_collaborator_id
   for update;

  if not found then
    raise exception 'Colaborador não encontrado.';
  end if;

  if v_current_active = p_active then
    return true;
  end if;

  select nullif(trim(full_name), '')
    into v_actor_name
    from public.profiles
   where user_id = auth.uid()
   limit 1;

  v_actor_name := coalesce(v_actor_name, auth.jwt() ->> 'email', 'Usuário interno');

  if p_active then
    update public.ps_collaborators
       set active = true,
           inactive_reason_category = null,
           inactive_reason = null,
           inactivated_at = null,
           inactivated_by = null,
           inactivated_by_name = null,
           updated_at = now()
     where id = p_collaborator_id;

    insert into public.ps_collaborator_status_history (
      collaborator_id, active, reason, changed_by, changed_by_name
    ) values (
      p_collaborator_id, true, 'Colaborador reativado.', auth.uid(), v_actor_name
    );
  else
    if p_reason_category not in (
      'medical_leave', 'terminated', 'unavailable', 'duplicate_or_incorrect', 'other'
    ) then
      raise exception 'Selecione um motivo válido para inativar o colaborador.';
    end if;

    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Informe uma justificativa para inativar o colaborador.';
    end if;

    update public.ps_collaborators
       set active = false,
           inactive_reason_category = p_reason_category,
           inactive_reason = trim(p_reason),
           inactivated_at = now(),
           inactivated_by = auth.uid(),
           inactivated_by_name = v_actor_name,
           updated_at = now()
     where id = p_collaborator_id;

    insert into public.ps_collaborator_status_history (
      collaborator_id, active, reason_category, reason, changed_by, changed_by_name
    ) values (
      p_collaborator_id, false, p_reason_category, trim(p_reason), auth.uid(), v_actor_name
    );
  end if;

  return true;
end;
$$;

revoke all on function public.ps_set_collaborator_active(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.ps_set_collaborator_active(uuid, boolean, text, text) to authenticated;
grant execute on function public.ps_set_collaborator_active(uuid, boolean, text, text) to service_role;

comment on table public.ps_collaborator_status_history is
  'Histórico auditável de ativações e inativações do banco de fiscais.';
comment on function public.ps_set_collaborator_active(uuid, boolean, text, text) is
  'Altera o status do colaborador exigindo motivo ao inativar e registra o responsável.';
