create table if not exists public.ps_event_payment_decision_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ps_events(id) on delete cascade,
  event_collaborator_id uuid not null references public.ps_event_collaborators(id) on delete cascade,
  decision text not null check (decision in ('ready','review','no_pay')),
  reason text not null check (char_length(btrim(reason)) >= 3),
  active boolean not null default true,
  decided_by uuid default auth.uid(),
  decided_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists ps_event_payment_decision_overrides_active_unique
  on public.ps_event_payment_decision_overrides(event_id,event_collaborator_id)
  where active;

create index if not exists ps_event_payment_decision_overrides_event_idx
  on public.ps_event_payment_decision_overrides(event_id,active,decided_at desc);

alter table public.ps_event_payment_decision_overrides enable row level security;

drop policy if exists "ps payment override admin read" on public.ps_event_payment_decision_overrides;
create policy "ps payment override admin read"
on public.ps_event_payment_decision_overrides for select to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "ps payment override admin manage" on public.ps_event_payment_decision_overrides;
create policy "ps payment override admin manage"
on public.ps_event_payment_decision_overrides for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select,insert,update,delete on public.ps_event_payment_decision_overrides to authenticated;

create or replace function public.ps_set_payment_decision_override(
  p_event_id uuid,p_event_collaborator_id uuid,p_decision text,p_reason text
) returns uuid
language plpgsql security definer
set search_path=public,pg_temp
as $function$
declare v_id uuid; v_reason text := btrim(coalesce(p_reason,''));
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if p_decision not in ('ready','review','no_pay') then raise exception 'invalid_payment_decision'; end if;
  if char_length(v_reason) < 3 then raise exception 'override_reason_required'; end if;
  if not exists (
    select 1 from public.ps_event_collaborators
    where id=p_event_collaborator_id and event_id=p_event_id
  ) then raise exception 'event_collaborator_not_found'; end if;

  update public.ps_event_payment_decision_overrides
  set active=false,revoked_at=now(),revoked_by=auth.uid()
  where event_id=p_event_id and event_collaborator_id=p_event_collaborator_id and active;

  insert into public.ps_event_payment_decision_overrides(
    event_id,event_collaborator_id,decision,reason,active,decided_by
  ) values (p_event_id,p_event_collaborator_id,p_decision,v_reason,true,auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.ps_clear_payment_decision_override(
  p_event_id uuid,p_event_collaborator_id uuid
) returns void
language plpgsql security definer
set search_path=public,pg_temp
as $function$
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  update public.ps_event_payment_decision_overrides
  set active=false,revoked_at=now(),revoked_by=auth.uid()
  where event_id=p_event_id and event_collaborator_id=p_event_collaborator_id and active;
end;
$function$;

revoke all on function public.ps_set_payment_decision_override(uuid,uuid,text,text) from public;
revoke all on function public.ps_clear_payment_decision_override(uuid,uuid) from public;
grant execute on function public.ps_set_payment_decision_override(uuid,uuid,text,text) to authenticated;
grant execute on function public.ps_clear_payment_decision_override(uuid,uuid) to authenticated;
