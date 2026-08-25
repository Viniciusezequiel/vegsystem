# Relatório de prontidão para a virada — destino `sshyjnyvihdheofjzsca`

Data: 2026-08-25 · Produção continua 100% no backend atual da Lovable. Nenhuma sincronização incremental, nenhuma troca de variável, nenhum cron ativado.

## Status geral: **NÃO PRONTO PARA SINCRONIZAÇÃO FINAL**

Bloqueios (todos dependem de credencial que só você possui):
1. As 12 Edge Functions ainda **não estão publicadas** no destino (`404 NOT_FOUND` em todas).
2. `RESEND_API_KEY` e `RECURRING_TASKS_CRON_SECRET` ainda não configurados no destino.
3. `05-cron.sql` ainda não executado no destino.
4. Auth do destino (Site URL / Redirect URLs) ainda não configurado.

Comandos que faltam para você (nesta ordem):

```
supabase login
bash migracao/04-deploy-functions.sh
bash migracao/06-configure-secrets.sh          # substitua os placeholders antes
# SQL editor do destino: rodar migracao/05-cron.sql
DST_SERVICE_KEY=... DST_ANON_KEY=... bash migracao/07-validacao-destino.sh
```

Nada além disso é necessário no terminal. Não envie nenhuma chave no chat.

## 1. Edge Functions

**Necessárias no destino (12) — código pronto, revisado, compatível:**

| Função | Finalidade | Chamadores | Tabelas | Secrets | Externo | Auth | Service role |
|---|---|---|---|---|---|---|---|
| `create-user` | cria usuário + perfil + role | `Users.tsx` | profiles, user_roles | padrão | – | JWT admin | sim |
| `delete-user` | remove usuário | `useUsers.ts` | profiles, user_roles | padrão | – | JWT admin | sim |
| `reset-password` | redefine senha | `Users.tsx` | user_roles, profiles | padrão | – | JWT admin | sim |
| `update-user-email` | troca e-mail | admin | user_roles, profiles, external_users | padrão | – | JWT em código | sim |
| `setup-first-admin` | 1º admin | `Setup.tsx` | profiles, user_roles | `ADMIN_SETUP_KEY` (opc.) | – | pública protegida | sim |
| `create-classroom-call` | chamado público | form público | classroom_calls | padrão | – | pública | sim |
| `get-classroom-call-config` | salas/problemas públicos | form público | classroom_call_rooms/_room_issues | padrão | – | pública | sim |
| `generate-pdf` | PDF de item | `pdfService.ts` | lost_items | padrão | esm.sh (jspdf) | JWT | não |
| `notify-task-assignment` | e-mail de atribuição | `useTasks.ts` | tasks, profiles | `RESEND_API_KEY` | Resend | JWT em código | sim |
| `process-recurring-tasks` | demandas recorrentes | pg_cron | tasks | `RECURRING_TASKS_CRON_SECRET` | – | cron secret | sim |
| `migrate-lost-item-image` | migra 1 imagem | `ItemsList.tsx` | lost_items + bucket | padrão | – | JWT admin | sim |
| `migrate-all-images` | migra todas as imagens | `ItemsList.tsx` | lost_items + bucket | padrão | – | JWT admin | sim |

- **Prontas para deploy:** as 12. Nenhuma referencia URL, project ref ou serviço da Lovable — todas leem `SUPABASE_URL`/chaves do ambiente, que o Supabase injeta por projeto.
- **Publicadas hoje no destino:** 0.
- **Pendentes:** as 12 (aguardam `04-deploy-functions.sh`).
- **Não migrar:** `export-migracao`, `export-storage-migracao`, `export-users-migracao` (temporárias da clonagem; remover após o período de observação, junto com a tela `/admin-module/migracao`).
- `supabase/config.toml` guarda o `project_id` antigo, mas é arquivo gerado e o deploy usa `--project-ref`; o que importa dele são os blocos `verify_jwt = false`, que vão para o destino.

## 2. Secrets

| Secret | Classificação |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` | automático/padrão do Supabase |
| `RESEND_API_KEY` | **precisa ser configurado** |
| `RECURRING_TASKS_CRON_SECRET` | **precisa ser configurado** |
| `ADMIN_SETUP_KEY` | opcional |
| `DST_SERVICE_KEY`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `LOVABLE_API_KEY` | não são mais necessários no destino |

Script pronto: `migracao/06-configure-secrets.sh` (recusa rodar com placeholders).

## 3. Cron jobs

Conferidos contra a produção atual — batem exatamente:

| Nome | Frequência | Executa | Tabelas | Destino |
|---|---|---|---|---|
| `expire-lost-items-daily` | `0 * * * *` | `public.expire_old_lost_items()` | lost_items | preparado, **desativado** |
| `process-recurring-tasks-daily` | `0 6 * * *` | POST `process-recurring-tasks` | tasks | preparado, **desativado** |
| `process-recurring-tasks-hourly` | `15 * * * *` | POST `process-recurring-tasks` | tasks | preparado, **desativado** |

`05-cron.sql` é idempotente (`unschedule` condicional + `schedule` + `active=false`). Ativação isolada em `05b-ativar-cron-na-virada.sql`, para rodar **só depois** de desligar os jobs da origem.

## 4. Auth

- **Providers em uso: apenas e-mail/senha.** Não há `signInWithOAuth` no código — nenhum Google/Microsoft/GitHub a configurar.
- **Site URL:** `https://vegsystem.site`
- **Redirect URLs:** `https://vegsystem.site/**`, `https://vegsystem.lovable.app/**`, `https://id-preview--9c25c02c-b1fb-4d21-be2a-9079016fc469.lovable.app/**`, `http://localhost:8080/**`
- **Reset de senha / confirmação:** o link cai em `/change-password`, que chama `updateUser` e limpa `force_password_change`. Ajustei o `resetPasswordForEmail` para apontar para `/change-password` (antes ia para `/admin-auth`, onde o usuário entrava sem definir senha).
- Removi a chave fixa `sb-ugzrewnbpljswwboctfh-auth-token` do `AuthContext`; agora é derivada de `VITE_SUPABASE_PROJECT_ID` — sem isso a sessão ficaria órfã após a virada.
- Signups públicos devem permanecer **desabilitados** no destino; contas são criadas por admin.
- Fluxo do primeiro acesso pós-virada: usuário → "esqueci minha senha" → e-mail → `/change-password` → nova senha. Os 32 UUIDs/e-mails já estão no destino e casam com `profiles.user_id` e `user_roles`.

## 5. Resend / e-mail

- Única função que envia e-mail: `notify-task-assignment`, via `https://api.resend.com/emails`, com tratamento de erro e log; falha não quebra o fluxo da demanda (fire-and-forget no frontend).
- Remetente atual: `VEG System <onboarding@resend.dev>` — esse remetente só entrega para o dono da conta Resend. **Recomendo verificar `vegsystem.site` no Resend e trocar o `from`** para entregar aos colaboradores.
- Nenhuma URL do backend antigo é embutida nos e-mails (o corpo usa dados da demanda).
- Teste seguro sugerido no dia D: criar 1 demanda de teste atribuída ao seu próprio e-mail — nunca disparo em massa.

## 6. Storage

- `lost-items`: existe, **privado**, mesmos paths da origem, 4.427 arquivos. Listagem OK, URL assinada gerada e download efetivo validado (`200`, 23 KB).
- `task-attachments`: existe, privado, vazio (igual à origem).
- Acesso por service role (usado pelas Edge Functions) validado.
- Nada foi apagado ou movido na origem.

## 7. Webhooks e integrações

- Webhooks de banco (`supabase_functions.http_request`): **nenhum**.
- Referências ao project ref antigo no código: **apenas** `supabase/config.toml` (arquivo gerado) — as 3 do `AuthContext` foram removidas nesta etapa.
- Sem filas, sem pagamentos, sem push de terceiros. Notificações locais são via Capacitor no cliente.
- Integrações externas: Resend, CDNs `esm.sh`/`deno.land` (imports das funções).
- Frontend acessa o backend só por `@/integrations/supabase/client`, que lê o `.env` — a virada é troca de variável, sem alteração de import.

## 8. Testes executados no destino (não destrutivos)

| Teste | Resultado |
|---|---|
| REST root | 200 |
| Leitura `tasks` (service role) | 200 |
| Insert de registro de teste `[MIGRACAO-TESTE]` | 201 |
| Update do registro de teste | 204 |
| Delete do registro de teste (removido) | 204 |
| Auth Admin API (listar usuários) | 200, usuários migrados presentes |
| RPC `get_public_reservations` | 200 |
| RPC `has_role(admin)` | `true` |
| Storage: listar `lost-items` | 200 |
| Storage: URL assinada + download | 200 (arquivo íntegro) |
| Storage: `task-attachments` | 200, vazio (esperado) |
| Edge Functions (12) | **404 — não publicadas** |
| Testes com chave anon (RLS pública) | pendentes: exigem a chave publicável do destino (`DST_ANON_KEY` no `07-validacao-destino.sh`) |

Nenhum dado real foi alterado; o único registro criado foi de teste e já foi excluído.

## 9. Scripts disponíveis

`04-deploy-functions.sh` · `05-cron.sql` · `05b-ativar-cron-na-virada.sql` · `06-configure-secrets.sh` · `07-validacao-destino.sh` · `08-sincronizacao-final.sh` (bloqueado por `CONFIRMO_SINCRONIZACAO=SIM`) · `09-validacao-pos-sincronizacao.sh` · `10-plano-virada.md`

## 10. Dependências que ainda são exclusivas do backend atual

- Edge Functions em execução (todas as chamadas do app hoje vão para o Cloud).
- Cron jobs ativos (expiração de achados e demandas recorrentes).
- Sessões de login vigentes.
- Registros criados após `2026-08-25 16:45 UTC` (alvo da sincronização incremental).
