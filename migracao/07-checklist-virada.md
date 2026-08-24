# Checklist da virada — destino `sshyjnyvihdheofjzsca`

Ordem obrigatória. Não pule para o passo 5 antes do 4 estar 100% verde.

## 1. Preparação (local)

- [ ] `migracao/.env.migracao` criado com as 7 variáveis (modelo no README)
- [ ] `source migracao/.env.migracao && bash migracao/00-preflight.sh` sem pendências

## 2. Cópia dos dados

- [ ] `bash migracao/01-export.sh` — pasta `migracao/dump/` gerada e guardada em local seguro
- [ ] `bash migracao/02-import.sh` — estrutura + auth + dados restaurados
- [ ] `node migracao/03-storage-copy.mjs` — buckets `lost-items` e `task-attachments` copiados, 0 falhas
- [ ] `node migracao/06-verify.mjs` — todas as tabelas conferem

## 3. Backend do projeto novo

- [ ] Segredos das funções cadastrados: `RESEND_API_KEY`, `RECURRING_TASKS_CRON_SECRET`
- [ ] `bash migracao/04-deploy-functions.sh` — 12 funções publicadas
- [ ] `psql "$DST_DB_URL" -f migracao/05-cron.sql` — 2 jobs ativos (troque a service_role e o cron secret no arquivo antes)
- [ ] **GRANT EXECUTE para `anon`** conferido nas funções públicas:

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_pode
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_public_classroom_call','create_public_uber_request',
    'get_public_classroom_call_status','get_public_reservations',
    'ps_public_event_roster','ps_public_sign_attendance','ps_public_submit_evaluation'
  )
order by 1;
```

Se alguma vier `false`:

```sql
grant execute on function public.<nome>(<assinatura>) to anon;
```

- [ ] Authentication → URL Configuration:
  - Site URL: `https://vegsystem.site`
  - Redirect URLs: `https://vegsystem.site/**`, `https://vegsystem.lovable.app/**`, URL de preview do Lovable
- [ ] Authentication → Providers: replicar o que está ativo hoje (e-mail/senha; Google se usado)
- [ ] Database → Replication: habilitar Realtime nas tabelas escutadas pelo app
      (`classroom_calls`, `tasks`, `equipment_loans`, `reservations`, `lost_items`, `material_requests`, `locker_loans`)
- [ ] Extensões `pg_cron` e `pg_net` habilitadas

## 4. Apontar o app e testar

- [ ] Lovable → **Connectors → Supabase** → conectar a conta e selecionar o projeto `sshyjnyvihdheofjzsca`
- [ ] `.env` regravado automaticamente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) — não editar à mão
- [ ] Checklist de testes do `README.md` executado inteiro, sem falhas

## 5. Desligar o Lovable Cloud (irreversível)

- [ ] Pasta `migracao/dump/` guardada fora da máquina de trabalho
- [ ] Todos os itens acima marcados
- [ ] Cloud → Advanced → Disconnect

> Enquanto o passo 5 não for feito, o rollback é simples: reconectar o projeto antigo em Connectors.
