create table if not exists public.lab_loans (
  id uuid primary key default gen_random_uuid(),
  borrower_name text not null,
  borrower_sector text not null,
  borrower_phone text,
  activity_type text not null check (activity_type in ('aula','monitoria','tcc','coleta','iniciacao_cientifica','outra')),
  activity_other text,
  shift text not null check (shift in ('manha','tarde','noite')),
  status text not null default 'active' check (status in ('active','returned','cancelled')),
  borrower_signature text,
  return_signature text,
  notes text,
  loaned_by uuid default auth.uid(),
  returned_by uuid,
  returned_at timestamptz,
  manual_close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_loan_items (
  id uuid primary key default gen_random_uuid(),
  lab_loan_id uuid not null references public.lab_loans(id) on delete cascade,
  item_type text not null check (item_type in ('locker','equipment','manual')),
  locker_id uuid references public.lockers(id),
  equipment_id uuid references public.equipment(id),
  manual_item_name text,
  quantity integer not null default 1 check (quantity > 0),
  usage_mode text not null default 'lab_use' check (usage_mode in ('lab_use','removal')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint lab_loan_item_target_check check (
    (item_type='locker' and locker_id is not null)
    or (item_type='equipment' and equipment_id is not null)
    or (item_type='manual' and nullif(btrim(manual_item_name),'') is not null)
  )
);

create unique index if not exists lab_loan_items_active_locker_unique
  on public.lab_loan_items(locker_id)
  where active and locker_id is not null;
create index if not exists lab_loans_status_created_idx on public.lab_loans(status, created_at desc);
create index if not exists lab_loan_items_loan_idx on public.lab_loan_items(lab_loan_id);

alter table public.lab_loans enable row level security;
alter table public.lab_loan_items enable row level security;

create policy "Internal users can view lab loans" on public.lab_loans for select using (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Internal users can insert lab loans" on public.lab_loans for insert with check (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Internal users can update lab loans" on public.lab_loans for update using (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
) with check (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Only admins can delete lab loans" on public.lab_loans for delete to authenticated using (is_admin(auth.uid()));

create policy "Internal users can view lab loan items" on public.lab_loan_items for select using (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Internal users can insert lab loan items" on public.lab_loan_items for insert with check (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Internal users can update lab loan items" on public.lab_loan_items for update using (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
) with check (
  has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'analista'::app_role)
  or has_role(auth.uid(), 'assistente'::app_role) or has_role(auth.uid(), 'supervisor'::app_role)
);
create policy "Only admins can delete lab loan items" on public.lab_loan_items for delete to authenticated using (is_admin(auth.uid()));

grant select, insert, update, delete on public.lab_loans to authenticated;
grant select, insert, update, delete on public.lab_loan_items to authenticated;

create or replace function public.create_lab_loan(
  p_borrower_name text,
  p_borrower_sector text,
  p_borrower_phone text,
  p_activity_type text,
  p_activity_other text,
  p_shift text,
  p_borrower_signature text,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql security invoker set search_path=public,pg_temp
as $function$
declare v_id uuid; v_item jsonb; v_locker uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if nullif(btrim(p_borrower_name),'') is null then raise exception 'borrower_name_required'; end if;
  if nullif(btrim(p_borrower_sector),'') is null then raise exception 'borrower_sector_required'; end if;
  if p_activity_type not in ('aula','monitoria','tcc','coleta','iniciacao_cientifica','outra') then raise exception 'invalid_activity_type'; end if;
  if p_shift not in ('manha','tarde','noite') then raise exception 'invalid_shift'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'items_required'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'item_type','')='locker' then
      v_locker := nullif(v_item->>'locker_id','')::uuid;
      if v_locker is null then raise exception 'locker_required'; end if;
      if exists(select 1 from public.locker_loans where locker_id=v_locker and status='active')
         or exists(select 1 from public.lab_loan_items where locker_id=v_locker and active) then
        raise exception 'locker_already_in_use';
      end if;
    end if;
  end loop;

  insert into public.lab_loans(
    borrower_name,borrower_sector,borrower_phone,activity_type,activity_other,shift,
    borrower_signature,notes,loaned_by
  ) values (
    btrim(p_borrower_name),btrim(p_borrower_sector),nullif(btrim(coalesce(p_borrower_phone,'')),''),
    p_activity_type,nullif(btrim(coalesce(p_activity_other,'')),''),p_shift,
    nullif(p_borrower_signature,''),nullif(btrim(coalesce(p_notes,'')),''),auth.uid()
  ) returning id into v_id;

  insert into public.lab_loan_items(lab_loan_id,item_type,locker_id,equipment_id,manual_item_name,quantity,usage_mode,active)
  select v_id,item->>'item_type',nullif(item->>'locker_id','')::uuid,nullif(item->>'equipment_id','')::uuid,
         nullif(btrim(coalesce(item->>'manual_item_name','')),''),greatest(coalesce((item->>'quantity')::integer,1),1),
         coalesce(nullif(item->>'usage_mode',''),'lab_use'),true
  from jsonb_array_elements(p_items) item;

  return v_id;
end;
$function$;

create or replace function public.return_lab_loan(
  p_lab_loan_id uuid,
  p_return_signature text,
  p_notes text default null,
  p_manual_reason text default null
) returns void
language plpgsql security invoker set search_path=public,pg_temp
as $function$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.lab_loans where id=p_lab_loan_id and status='active') then raise exception 'active_lab_loan_not_found'; end if;
  if nullif(p_return_signature,'') is null and nullif(btrim(coalesce(p_manual_reason,'')),'') is null then raise exception 'return_signature_or_manual_reason_required'; end if;

  update public.lab_loans
  set status='returned', return_signature=nullif(p_return_signature,''), returned_by=auth.uid(), returned_at=now(),
      manual_close_reason=nullif(btrim(coalesce(p_manual_reason,'')),''),
      notes=case when nullif(btrim(coalesce(p_notes,'')),'') is null then notes
                 when nullif(btrim(coalesce(notes,'')),'') is null then btrim(p_notes)
                 else notes || E'\n' || btrim(p_notes) end,
      updated_at=now()
  where id=p_lab_loan_id;

  update public.lab_loan_items set active=false where lab_loan_id=p_lab_loan_id and active;
end;
$function$;

revoke all on function public.create_lab_loan(text,text,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.return_lab_loan(uuid,text,text,text) from public;
grant execute on function public.create_lab_loan(text,text,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.return_lab_loan(uuid,text,text,text) to authenticated;
