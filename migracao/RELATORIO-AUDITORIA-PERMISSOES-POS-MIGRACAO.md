# Auditoria de permissões pós-migração — VEG System

- **Origem (legado, somente leitura):** `ugzrewnbpljswwboctfh` (Lovable Cloud)
- **Destino (definitivo):** `sshyjnyvihdheofjzsca.supabase.co`
- **Frontend definitivo:** https://www.vegsystem.site (Vercel)
- **Data desta rodada:** 2026-08-26

---

## 1. Método

Foram usadas três fontes cruzadas:

1. Snapshot `public._grants_backup_virada` + ACLs reais (`pg_class`, `pg_proc`) e
   `pg_policies` lidos **na origem**.
2. Sondagem funcional do destino via PostgREST/GoTrue/Storage com a
   **service key** e com a **publishable key** (`sb_publishable_...`).
3. **Testes reais de usuário** no destino: dois usuários temporários criados via
   Admin API — um `assistente` (usuário interno comum) e o mesmo usuário
   promovido a `admin` — com login por senha e execução de INSERT/UPDATE/DELETE
   reais. Todos os registros e usuários de teste foram removidos ao final
   (varredura por marcadores `__TESTE_MIGRACAO__` / `__TSTMIG__` = 0 resíduos).

## 2. GRANTs de tabela, sequences e schema

- **Nenhum GRANT ausente.** Nenhum erro `permission denied for table` foi
  observado em nenhuma das 58 tabelas; `anon` e `authenticated` possuem
  SELECT/INSERT/UPDATE/DELETE no destino. Todas as falhas de escrita retornaram
  `42501 row-level security`, ou seja, o problema **nunca foi GRANT**.
- **Sequences:** a única sequence do schema `public` é
  `_grants_backup_virada_id_seq` (artefato de migração). Todas as PKs de negócio
  são `uuid` com `gen_random_uuid()` → não há privilégio de sequence a conceder.
- **Schema USAGE:** `public` acessível para `anon`, `authenticated`,
  `service_role` (comprovado pelo funcionamento da Data API).
- **Excesso no destino:** `anon` recebeu privilégios em `classroom_calls`,
  `ps_evaluations`, `ps_event_collaborators` e `uber_requests`, onde a origem já
  os havia revogado → tratado no script 14 (REVOKE).

## 3. RLS — teste real de usuário interno

| Tabela / módulo | assistente | admin | Origem | Veredito |
|---|---|---|---|---|
| tasks (Demandas) | INSERT ok, UPDATE ok, DELETE bloqueado | tudo ok | delete só admin | OK |
| lost_items (Achados) | INSERT ok, UPDATE ok, DELETE bloqueado | tudo ok | idem | OK |
| reservations (Reservas) | INSERT ok, UPDATE ok, DELETE bloqueado | tudo ok | idem | OK |
| equipment_loans (Empréstimos/baixa) | INSERT ok, UPDATE(status=returned) ok | tudo ok | idem | OK |
| classroom_calls (Chamados de sala) | INSERT ok, UPDATE(accepted) ok | tudo ok | idem | OK |
| activity_logs | INSERT ok | ok | idem | OK |
| shift_handovers / room_checklists | exigem `filled_by = auth.uid()` | ok | idem | OK |
| material_requests | exige `requester_id = auth.uid()` | ok | idem | OK |
| rooms / equipment / lockers / reservation_rooms / semester_competencies / app_settings / role_permissions / user_roles / profiles | bloqueado p/ assistente | ok p/ admin | admin/analista | OK |
| **uber_requests** | **INSERT 42501** | ok | **origem permite `is_internal_user`** | **FALHA → corrigida no script 14** |

**Causa raiz encontrada:** a clonagem não trouxe a policy
`"Internal staff can create uber requests"` (INSERT, `authenticated`,
`WITH CHECK is_internal_user(auth.uid())`) para `public.uber_requests`. No
destino sobraram apenas as policies de admin, e por isso usuários internos
não conseguiam cadastrar solicitações de Uber Corporativo. Foi a **única
divergência funcional de RLS** encontrada na varredura de INSERT feita sobre as
58 tabelas (todas as demais recusas coincidem com as policies da origem).

Funções auxiliares `is_internal_user()`, `is_admin()`, `has_role()`,
`has_permission()`, `is_admin_or_analista()` estão presentes e **funcionam
corretamente** no destino (comprovado: os INSERTs que dependem delas passam).
`user_roles` e `profiles` foram migrados corretamente (32 usuários, papéis
preservados).

## 4. RPCs

17 RPCs expostas. Todas respondem. Regressão de segurança confirmada: por
default do PostgreSQL, **todas** ficaram com `EXECUTE` para `PUBLIC` no destino,
incluindo `expire_old_lost_items`, `is_admin`, `has_role`, `has_permission`,
`get_linked_rooms` e `check_reservation_conflict` — na origem o `EXECUTE` era
restrito. O script 14 revoga de PUBLIC e reconcede por papel, mantendo `anon`
apenas nas 7 superfícies realmente públicas.

## 5. /chamado-sala (anônimo)

- Página carrega sem sessão; catálogos `classroom_call_rooms` e
  `classroom_call_room_issues` legíveis por `anon` (HTTP 200).
- Envio: `create_public_classroom_call(...)` executado com a publishable key
  **sem login** → HTTP 200, chamado criado (registro de teste removido).
- Acompanhamento: `get_public_classroom_call_status(uuid)` (4 campos, janela de
  6 h).
- `anon` **não** obtém listagem de `classroom_calls` (retorno vazio) e não pode
  UPDATE/DELETE. Após o script 14 o `anon` perde também o GRANT residual na
  tabela, permanecendo só o caminho via RPC `SECURITY DEFINER` (que já valida e
  trunca as entradas). A Edge Function antiga `create-classroom-call` continua
  publicada e não foi alterada.

## 6. Storage

Buckets `lost-items` e `task-attachments` — **privados** (`public: false`).
Testado com usuário autenticado: upload 200, download 200, signed URL 200,
delete 200; download por rota pública anônima: 400 (bloqueado). Nenhuma policy
de storage foi alterada.

## 7. Edge Functions

12 funções publicadas no destino (as 4 auxiliares de migração não foram
publicadas — correto). Verificação de proteção:

| Função | anon | assistente | admin |
|---|---|---|---|
| create-user | 401 | 403 | permitido |
| delete-user | 401 | 403 | permitido |
| reset-password | 401 | 403 | permitido |
| process-recurring-tasks | 401 | 401 | só com segredo do cron |
| setup-first-admin | desabilitada (sem segredo configurado) | | |
| get-classroom-call-config | 200 (pública por design) | 200 | 200 |

## 8. Cron

Origem (legado): os 3 jobs estavam **ativos** e foram **desativados** em
2026-08-26 via `cron.alter_job(..., active := false)` — confirmado
`active = false` para `expire-lost-items-daily`,
`process-recurring-tasks-daily` e `process-recurring-tasks-hourly`. Os jobs não
foram apagados (rollback possível). Ativação no destino: ver
`migracao/05b-ativar-cron-na-virada.sql`.

## 9. Frontend

`npm run build` concluído com sucesso. Nenhuma referência a projetos Supabase
antigos no código da aplicação (apenas `supabase/config.toml`, arquivo gerado
pela Lovable e não utilizado pelo build da Vercel). O bundle publicado em
https://www.vegsystem.site aponta para `sshyjnyvihdheofjzsca.supabase.co` com
chave publishable. Nenhuma service key ou segredo versionado no frontend.

## 10. Ação pendente de aplicação

O script `migracao/14-corrigir-permissoes-pos-migracao.sql` e a ativação dos
crons exigem conexão SQL de owner (`postgres`) no destino, indisponível neste
ambiente (só existem chaves de API). Devem ser executados no SQL Editor do
projeto de destino ou via `psql "$DST_DB_URL"`.
