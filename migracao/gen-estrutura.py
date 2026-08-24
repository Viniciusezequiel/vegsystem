import json, subprocess, sys

def q(sql):
    r = subprocess.run(["psql","-tAc", "select coalesce(json_agg(t),'[]') from ("+sql+") t"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr); sys.exit(1)
    return json.loads(r.stdout.strip())

out = []
w = out.append

w("-- Estrutura completa do banco (estado real atual)\n-- Gerada a partir dos catalogos do Postgres\n")
w("SET statement_timeout = 0;\nSET client_min_messages = warning;\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";\n")

# ENUMS
w("\n-- ============ ENUMS ============\n")
for e in q("""
select t.typname as name, string_agg(quote_literal(l.enumlabel), ', ' order by l.enumsortorder) as labels
from pg_type t join pg_enum l on l.enumtypid=t.oid
join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'
group by t.typname order by t.typname"""):
    w(f"DO $$ BEGIN CREATE TYPE public.{e['name']} AS ENUM ({e['labels']}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

# SEQUENCES (standalone)
seqs = q("""
select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='S' and n.nspname='public'
and not exists (select 1 from pg_depend d where d.objid=c.oid and d.deptype='a')
order by 1""")
if seqs:
    w("\n-- ============ SEQUENCES ============\n")
    for s in seqs:
        w(f"CREATE SEQUENCE IF NOT EXISTS public.{s['name']};")

# TABLES
w("\n-- ============ TABELAS ============\n")
tables = [t['name'] for t in q("""
select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public' order by 1""")]

cols = q("""
select c.relname as tbl, a.attname as col, format_type(a.atttypid,a.atttypmod) as typ,
  a.attnotnull as notnull, pg_get_expr(d.adbin,d.adrelid) as def,
  a.attidentity as ident, a.attnum as num
from pg_class c join pg_namespace n on n.oid=c.relnamespace
join pg_attribute a on a.attrelid=c.oid
left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
where c.relkind='r' and n.nspname='public' and a.attnum>0 and not a.attisdropped
order by c.relname, a.attnum""")
bytable = {}
for c in cols:
    bytable.setdefault(c['tbl'], []).append(c)

for t in tables:
    lines = []
    for c in bytable.get(t, []):
        s = f'  "{c["col"]}" {c["typ"]}'
        if c['ident'] in ('a','d'):
            s += f" GENERATED {'ALWAYS' if c['ident']=='a' else 'BY DEFAULT'} AS IDENTITY"
        elif c['def']:
            s += f" DEFAULT {c['def']}"
        if c['notnull']:
            s += " NOT NULL"
        lines.append(s)
    w(f"CREATE TABLE IF NOT EXISTS public.{t} (\n" + ",\n".join(lines) + "\n);")

# CONSTRAINTS: PK/UNIQUE/CHECK first, then FK
w("\n-- ============ CONSTRAINTS (PK / UNIQUE / CHECK) ============\n")
cons = q("""
select rel.relname as tbl, con.conname as name, con.contype::text as typ,
  pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid=con.conrelid
join pg_namespace n on n.oid=rel.relnamespace
where n.nspname='public' order by rel.relname, con.contype, con.conname""")
def emit_con(c):
    w(f"DO $$ BEGIN ALTER TABLE public.{c['tbl']} ADD CONSTRAINT {c['name']} {c['def']}; "
      f"EXCEPTION WHEN duplicate_table THEN NULL WHEN duplicate_object THEN NULL WHEN invalid_table_definition THEN NULL; END $$;")
for c in cons:
    if c['typ'] in ('p','u','c'):
        emit_con(c)
w("\n-- ============ FOREIGN KEYS ============\n")
for c in cons:
    if c['typ'] == 'f':
        emit_con(c)

# INDEXES
w("\n-- ============ INDICES ============\n")
for i in q("""
select indexdef as def from pg_indexes where schemaname='public'
and indexname not in (select conname from pg_constraint con join pg_class r on r.oid=con.conrelid
  join pg_namespace n on n.oid=r.relnamespace where n.nspname='public')
order by tablename, indexname"""):
    d = i['def'].replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ', 1).replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ', 1)
    w(d + ";")

# FUNCTIONS
w("\n-- ============ FUNCOES ============\n")
for f in q("""
select pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind in ('f','p')
order by p.proname"""):
    w(f['def'].rstrip().rstrip(';') + ";\n")

# TRIGGERS
w("\n-- ============ TRIGGERS ============\n")
for t in q("""
select tgname as name, c.relname as tbl, pg_get_triggerdef(tg.oid) as def
from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not tg.tgisinternal order by c.relname, tgname"""):
    w(f"DROP TRIGGER IF EXISTS {t['name']} ON public.{t['tbl']};")
    w(t['def'] + ";")

# RLS + REPLICA IDENTITY
w("\n-- ============ RLS ============\n")
for r in q("""
select c.relname as tbl, c.relrowsecurity as rls, c.relforcerowsecurity as force, c.relreplident::text as repl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public' order by 1"""):
    if r['rls']:
        w(f"ALTER TABLE public.{r['tbl']} ENABLE ROW LEVEL SECURITY;")
    if r['force']:
        w(f"ALTER TABLE public.{r['tbl']} FORCE ROW LEVEL SECURITY;")
    if r['repl'] == 'f':
        w(f"ALTER TABLE public.{r['tbl']} REPLICA IDENTITY FULL;")

# POLICIES
w("\n-- ============ POLICIES ============\n")
for p in q("""
select pol.polname as name, c.relname as tbl,
  case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' else 'ALL' end as cmd,
  pol.polpermissive as perm,
  coalesce((select string_agg(quote_ident(rolname), ', ') from pg_roles where oid = any(pol.polroles)), 'public') as roles,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expr
from pg_policy pol join pg_class c on c.oid=pol.polrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by c.relname, pol.polname"""):
    s = (f'DROP POLICY IF EXISTS "{p["name"]}" ON public.{p["tbl"]};\n'
         f'CREATE POLICY "{p["name"]}" ON public.{p["tbl"]} '
         f'AS {"PERMISSIVE" if p["perm"] else "RESTRICTIVE"} FOR {p["cmd"]} TO {p["roles"]}')
    if p['using_expr']:
        s += f"\n  USING ({p['using_expr']})"
    if p['check_expr']:
        s += f"\n  WITH CHECK ({p['check_expr']})"
    w(s + ";")

# GRANTS
w("\n-- ============ GRANTS ============\n")
for g in q("""
select table_name as tbl, grantee, string_agg(distinct privilege_type, ', ') as privs
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','service_role','postgres','authenticator')
group by table_name, grantee order by table_name, grantee"""):
    w(f"GRANT {g['privs']} ON public.{g['tbl']} TO {g['grantee']};")

w("\n-- Grants em sequences e funcoes\n")
w("""GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;""")
for g in q("""
select p.proname as fn, pg_get_function_identity_arguments(p.oid) as args, r.rolname as grantee
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
join pg_roles r on r.oid=a.grantee
where n.nspname='public' and a.privilege_type='EXECUTE' and r.rolname in ('anon','authenticated','service_role')
order by p.proname"""):
    w(f"GRANT EXECUTE ON FUNCTION public.{g['fn']}({g['args']}) TO {g['grantee']};")

# REALTIME publication
pub = q("""
select c.relname as tbl from pg_publication_rel pr
join pg_class c on c.oid=pr.prrelid join pg_namespace n on n.oid=c.relnamespace
join pg_publication p on p.oid=pr.prpubid
where n.nspname='public' and p.pubname='supabase_realtime' order by 1""")
if pub:
    w("\n-- ============ REALTIME ============\n")
    w("DO $$ BEGIN CREATE PUBLICATION supabase_realtime; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
    for t in pub:
        w(f"DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.{t['tbl']}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")

open("migracao/dump/01_estrutura.sql","w").write("\n".join(out) + "\n")
print("tables:", len(tables))
