-- JANELA DE MANUTENÇÃO (READ-ONLY) NA ORIGEM — Lovable Cloud
--
-- Objetivo: entre o último delta e a troca do domínio, garantir que nenhuma
-- gravação nova entre no banco antigo. Aplicado no nível do banco, portanto
-- vale para qualquer cliente (app publicada, PWA em cache, integrações).
--
-- NÃO executar agora. Executar apenas no momento da virada, na ORIGEM.
-- É totalmente reversível pela seção 3.

-- =====================================================================
-- 1) SNAPSHOT DOS GRANTS ATUAIS (obrigatório antes de revogar)
-- =====================================================================
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

select count(*) as grants_salvos from public._grants_backup_virada;

-- =====================================================================
-- 2) ENTRAR EM READ-ONLY (revoga escrita de anon e authenticated)
--    service_role permanece intacto para o script de sincronização.
-- =====================================================================
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

-- Storage: bloqueia upload/alteração de arquivos na origem
revoke insert, update, delete on storage.objects from anon, authenticated;

-- Verificação: deve retornar 0 linhas
select g.grantee, g.table_name, g.privilege_type
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.grantee in ('anon', 'authenticated')
  and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE');

-- =====================================================================
-- 3) ROLLBACK — restaura exatamente os grants salvos na seção 1
-- =====================================================================
-- do $$
-- declare r record;
-- begin
--   for r in select distinct grantee, table_name, privilege_type
--            from public._grants_backup_virada
--   loop
--     execute format('grant %s on public.%I to %I',
--                    r.privilege_type, r.table_name, r.grantee);
--   end loop;
-- end $$;
--
-- grant insert, update, delete on storage.objects to authenticated;
-- -- Reaplique o grant de anon em storage.objects apenas se ele existia antes.
