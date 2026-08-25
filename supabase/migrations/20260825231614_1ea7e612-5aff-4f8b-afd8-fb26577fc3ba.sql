create table if not exists public._grants_backup_virada (
  id bigserial primary key,
  grantee text not null,
  table_name text not null,
  privilege_type text not null,
  taken_at timestamptz not null default now()
);

insert into public._grants_backup_virada (grantee, table_name, privilege_type)
select g.grantee, g.table_name, g.privilege_type
from information_schema.role_table_grants g
join pg_tables t on t.schemaname = 'public' and t.tablename = g.table_name
where g.table_schema = 'public'
  and g.grantee in ('anon', 'authenticated')
  and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE');

do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_grants_backup_virada'
  loop
    execute format(
      'revoke insert, update, delete on public.%I from anon, authenticated',
      r.tablename
    );
  end loop;
end $$;

revoke insert, update, delete on storage.objects from anon, authenticated;