create table if not exists public.ps_event_operational_resolutions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ps_events(id) on delete cascade,
  issue_key text not null,
  entity_key text not null default 'event',
  resolution_type text not null default 'manual_exception'
    check (resolution_type in ('manual_exception','manual_resolution')),
  reason text not null check (char_length(btrim(reason)) >= 3),
  active boolean not null default true,
  resolved_by uuid default auth.uid(),
  resolved_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists ps_event_operational_resolutions_active_unique
  on public.ps_event_operational_resolutions(event_id, issue_key, entity_key)
  where active;

create index if not exists ps_event_operational_resolutions_event_idx
  on public.ps_event_operational_resolutions(event_id, active, resolved_at desc);

alter table public.ps_event_operational_resolutions enable row level security;

drop policy if exists "ps operational resolutions admin read" on public.ps_event_operational_resolutions;
create policy "ps operational resolutions admin read"
on public.ps_event_operational_resolutions for select to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "ps operational resolutions admin manage" on public.ps_event_operational_resolutions;
create policy "ps operational resolutions admin manage"
on public.ps_event_operational_resolutions for all to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.ps_event_operational_resolutions to authenticated;

create or replace function public.ps_set_event_operational_resolution(
  p_event_id uuid,
  p_issue_key text,
  p_reason text,
  p_resolution_type text default 'manual_exception',
  p_entity_key text default 'event'
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason,''));
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  if v_reason = '' or char_length(v_reason) < 3 then raise exception 'resolution_reason_required'; end if;
  if p_resolution_type not in ('manual_exception','manual_resolution') then raise exception 'invalid_resolution_type'; end if;
  if not exists (select 1 from public.ps_events where id = p_event_id) then raise exception 'event_not_found'; end if;

  update public.ps_event_operational_resolutions
  set active=false, revoked_at=now(), revoked_by=auth.uid()
  where event_id=p_event_id and issue_key=p_issue_key
    and entity_key=coalesce(nullif(btrim(p_entity_key),''),'event') and active;

  insert into public.ps_event_operational_resolutions(
    event_id,issue_key,entity_key,resolution_type,reason,active,resolved_by
  ) values (
    p_event_id,btrim(p_issue_key),coalesce(nullif(btrim(p_entity_key),''),'event'),
    p_resolution_type,v_reason,true,auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.ps_clear_event_operational_resolution(
  p_event_id uuid,
  p_issue_key text,
  p_entity_key text default 'event'
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required'; end if;
  update public.ps_event_operational_resolutions
  set active=false, revoked_at=now(), revoked_by=auth.uid()
  where event_id=p_event_id and issue_key=p_issue_key
    and entity_key=coalesce(nullif(btrim(p_entity_key),''),'event') and active;
end;
$function$;

revoke all on function public.ps_set_event_operational_resolution(uuid,text,text,text,text) from public;
revoke all on function public.ps_clear_event_operational_resolution(uuid,text,text) from public;
grant execute on function public.ps_set_event_operational_resolution(uuid,text,text,text,text) to authenticated;
grant execute on function public.ps_clear_event_operational_resolution(uuid,text,text) to authenticated;
