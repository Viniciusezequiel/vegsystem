# Preparação das dependências no Supabase de destino (`sshyjnyvihdheofjzsca`)

Status desta etapa: **inventário completo + artefatos prontos**. Produção continua 100% no backend atual da Lovable. Nenhuma sincronização incremental foi feita, nenhum job foi ativado, nenhuma variável de produção foi alterada.

## 1. Edge Functions

| Função | Finalidade | Chamada por | Tabelas | Secrets | Externo | Preso à Lovable? |
|---|---|---|---|---|---|---|
| `create-user` | Cria usuário + perfil + role (admin) | `src/pages/Users.tsx` | `profiles`, `user_roles`, `auth.users` | SUPABASE_URL/ANON/SERVICE_ROLE | – | Não |
| `delete-user` | Remove usuário (admin) | `src/hooks/useUsers.ts` | `auth.users`, `profiles`, `user_roles` | idem | – | Não |
| `reset-password` | Redefine senha (admin) | `src/pages/Users.tsx` | `user_roles`, `profiles` | idem | – | Não |
| `update-user-email` | Atualiza e-mail | interno/admin | `user_roles`, `profiles`, `external_users` | idem | – | Não |
| `setup-first-admin` | Cria o primeiro admin | `src/pages/Setup.tsx` | `profiles`, `user_roles` | + `ADMIN_SETUP_KEY` (opcional) | – | Não |
| `create-classroom-call` | Chamado de sala público | formulário público | `classroom_calls` | SERVICE_ROLE | – | Não |
| `get-classroom-call-config` | Config pública de salas/problemas | formulário público | `classroom_call_rooms`, `..._room_issues` | SERVICE_ROLE | – | Não |
| `generate-pdf` | PDF de item | `src/lib/pdfService.ts` | `lost_items` | ANON | esm.sh (jspdf) | Não |
| `notify-task-assignment` | E-mail de atribuição de demanda | `src/hooks/useTasks.ts` | `tasks`, `profiles` | + `RESEND_API_KEY` | api.resend.com | Não |
| `process-recurring-tasks` | Clona demandas recorrentes (cron) | pg_cron | `tasks` | + `RECURRING_TASKS_CRON_SECRET` | – | Não |
| `migrate-lost-item-image` | Migra 1 imagem base64 → Storage | `ItemsList` | `lost_items`, bucket `lost-items` | SERVICE_ROLE | – | Não |
| `migrate-all-images` | Migra todas as imagens | `ItemsList` | `lost_items`, bucket `lost-items` | SERVICE_ROLE | – | Não |

**Não precisam ser migradas** (temporárias, existem só para a clonagem e devem ser removidas depois da virada): `export-migracao`, `export-storage-migracao`, `export-users-migracao`.

Nenhuma função usa recurso exclusivo da Lovable — todas usam apenas `SUPABASE_URL`, chaves padrão e `Deno`. O deploy é feito por `migracao/04-deploy-functions.sh` (`supabase functions deploy`), que exige **o seu Personal Access Token do Supabase** (`supabase login`). Esse token não está disponível para mim aqui — é o único bloqueio desta etapa.

`verify_jwt = false` precisa valer no destino para: `setup-first-admin`, `create-classroom-call`, `update-user-email`, `get-classroom-call-config`, `notify-task-assignment` (já está em `supabase/config.toml`, que vai junto no deploy).

## 2. Secrets

| Secret | Situação no destino |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` | **Já configurados** (injetados automaticamente pelo Supabase) |
| `RESEND_API_KEY` | **Precisa ser configurado** por você (mesmo valor de hoje) |
| `RECURRING_TASKS_CRON_SECRET` | **Precisa ser configurado** por você (mesmo valor de hoje, e o mesmo usado no SQL do cron) |
| `ADMIN_SETUP_KEY` | Opcional — só se quiser proteger `setup-first-admin` |
| `DST_SERVICE_KEY`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS` | **Não são mais necessários** no destino (uso interno da migração/Lovable) |

Comando (na sua máquina, após `supabase link`):
`supabase secrets set RESEND_API_KEY=... RECURRING_TASKS_CRON_SECRET=...`

## 3. Cron jobs

Origem (ativos hoje):

| Nome | Frequência | Executa | Tabelas | Dependências |
|---|---|---|---|---|
| `expire-lost-items-daily` | `0 * * * *` | `public.expire_old_lost_items()` | `lost_items` | pg_cron |
| `process-recurring-tasks-daily` | `0 6 * * *` | POST `process-recurring-tasks` | `tasks` | pg_cron, pg_net, cron secret |
| `process-recurring-tasks-hourly` | `15 * * * *` | POST `process-recurring-tasks` | `tasks` | pg_cron, pg_net, cron secret |

Destino: `migracao/05-cron.sql` recria os três **desativados** (`active = false`). Risco real de duplicação de demandas recorrentes se rodarem nos dois ambientes — por isso só ativar na virada, depois de desligar os jobs da origem. O bloco de ativação está comentado no fim do arquivo.

## 4. Webhooks e integrações

- Webhooks de banco (`supabase_functions.http_request`): **nenhum** na origem.
- APIs externas: **Resend** (e-mail) em `notify-task-assignment`; CDNs `esm.sh`/`deno.land` nos imports.
- Pagamentos, filas, notificações push de terceiros: **nenhum**. Notificações locais são via Capacitor no cliente.
- Realtime: usado pelo app; conferir na virada se as tabelas estão na publicação (o dump já inclui a publicação).

## 5. Autenticação

32 usuários migrados com os mesmos UUIDs; `profiles.user_id`, `user_roles` e demais FKs continuam válidos. As funções usam `auth.getUser()` + `user_roles`, então funcionam sem alteração. Senhas não migram: cada usuário define nova senha no primeiro acesso após a virada (ou reset pelo admin).

## 6. Testes já executados no destino (não destrutivos)

- REST/PostgREST: `200`
- Storage: buckets `lost-items` e `task-attachments` presentes e privados
- Auth Admin API: `200`, usuários migrados listados
- RPC `get_public_reservations`: `200`
- Edge Functions: `404 NOT_FOUND` — nenhuma publicada ainda (esperado)

## 7. O que ainda impede a virada

1. Deploy das 12 Edge Functions no destino (precisa do seu token Supabase / `supabase login`).
2. Cadastro de `RESEND_API_KEY` e `RECURRING_TASKS_CRON_SECRET` no destino.
3. Rodar `05-cron.sql` (jobs ficam desativados).
4. Auth do destino: Site URL, Redirect URLs e providers de login.
5. Teste dos endpoints públicos com a chave publicável do destino (chamado de sala, uber, painel de reservas).
6. Sincronização incremental final (a partir de `2026-08-25 16:45 UTC`) — **não executada, aguardando sua autorização**.
