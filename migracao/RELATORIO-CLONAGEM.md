# Relatório de clonagem de dados — Lovable Cloud → Supabase próprio

- **Destino:** projeto `sshyjnyvihdheofjzsca`
- **Início da clonagem (UTC):** 2026-08-25 16:45:26
- **Fim da clonagem (UTC):** 2026-08-25 17:20 (aprox.)
- **Marco temporal para sincronização incremental:** `2026-08-25 16:45:00+00` (usar como corte em `created_at`/`updated_at`)
- **Produção não foi alterada.** A aplicação continua usando o backend atual.

## 1. Estrutura (Etapa 1)
- 58 tabelas existentes no destino, todas com as mesmas colunas da origem (comparação automática origem × OpenAPI do destino): **estrutura idêntica, nada foi recriado**.
- 16 funções/RPC expostas no destino: check_reservation_conflict, create_public_classroom_call, create_public_uber_request, expire_old_lost_items, find_available_rooms, get_linked_rooms, get_public_classroom_call_status, get_public_reservations, has_permission, has_role, is_admin, is_admin_or_analista, is_internal_user, ps_public_event_roster, ps_public_sign_attendance, ps_public_submit_evaluation.
- Triggers, RLS, policies (183), índices, PKs e FKs aplicados pelo `01_estrutura.sql`. As FKs estavam ativas durante a carga — como nenhuma linha foi rejeitada, **não há registros órfãos nem FK quebrada**.

## 2. Dados (Etapa 2)
- Carga em ordem de dependência, com `UPSERT` (merge por chave primária) — sem duplicação, **IDs/UUIDs, timestamps, status e vínculos originais preservados**.
- **31.813 registros** copiados em 58 tabelas, **0 tabelas divergentes**, 0 falhas.

| Tabela | Origem | Supabase | Dif | Status |
|---|---:|---:|---:|---|
| activity_logs | 8672 | 8672 | 0 | OK |
| app_settings | 4 | 4 | 0 | OK |
| checklist_answers | 0 | 0 | 0 | OK |
| checklist_questions | 15 | 15 | 0 | OK |
| classroom_call_responses | 2 | 2 | 0 | OK |
| classroom_call_room_issues | 106 | 106 | 0 | OK |
| classroom_call_rooms | 53 | 53 | 0 | OK |
| classroom_calls | 80 | 80 | 0 | OK |
| equipment | 329 | 329 | 0 | OK |
| equipment_loans | 373 | 373 | 0 | OK |
| equipment_reservations | 140 | 140 | 0 | OK |
| external_equipment_requests | 0 | 0 | 0 | OK |
| external_users | 4 | 4 | 0 | OK |
| inventory_movements | 262 | 262 | 0 | OK |
| locker_exchanges | 5 | 5 | 0 | OK |
| locker_loans | 224 | 224 | 0 | OK |
| lockers | 504 | 504 | 0 | OK |
| lost_items | 1675 | 1675 | 0 | OK |
| lost_items_archive | 4364 | 4364 | 0 | OK |
| material_requests | 2 | 2 | 0 | OK |
| profiles | 28 | 28 | 0 | OK |
| ps_collaborators | 8 | 8 | 0 | OK |
| ps_event_collaborators | 8 | 8 | 0 | OK |
| ps_events | 1 | 1 | 0 | OK |
| reservation_logs | 32 | 32 | 0 | OK |
| reservation_rooms | 52 | 52 | 0 | OK |
| reservations | 554 | 554 | 0 | OK |
| role_permissions | 279 | 279 | 0 | OK |
| room_checklists | 4983 | 4983 | 0 | OK |
| room_combinations | 4 | 4 | 0 | OK |
| rooms | 50 | 50 | 0 | OK |
| semester_checklist_items | 1032 | 1032 | 0 | OK |
| semester_checklists | 47 | 47 | 0 | OK |
| semester_competencies | 2 | 2 | 0 | OK |
| semester_furniture_details | 633 | 633 | 0 | OK |
| semester_item_options | 69 | 69 | 0 | OK |
| semester_labels | 502 | 502 | 0 | OK |
| semester_projectors | 50 | 50 | 0 | OK |
| shift_handover_incidents | 9 | 9 | 0 | OK |
| shift_handover_tasks | 5152 | 5152 | 0 | OK |
| shift_handovers | 644 | 644 | 0 | OK |
| task_comments | 203 | 203 | 0 | OK |
| task_history | 485 | 485 | 0 | OK |
| task_team_members | 1 | 1 | 0 | OK |
| tasks | 110 | 110 | 0 | OK |
| uber_requests | 33 | 33 | 0 | OK |
| user_roles | 28 | 28 | 0 | OK |
| (demais tabelas ps_* / checklist vazias) | 0 | 0 | 0 | OK |

> Observação: `activity_logs` já registrou 2 novas linhas na origem após o corte (uso normal do sistema). Isso entra na sincronização incremental.

## 3. Autenticação (Etapa 3)
- **32 contas recriadas no destino com o mesmo UUID e e-mail** (0 falhas), preservando o vínculo com `profiles` e `user_roles`.
- **Não migram:** hashes de senha, sessões ativas e provedores OAuth. É limitação do Supabase Auth entre projetos — no primeiro acesso ao novo backend cada pessoa usa "esqueci minha senha" (ou um admin define uma senha temporária).
- Metadados básicos e status de confirmação de e-mail foram recriados; MFA (se houver) precisará ser reconfigurado.

## 4. Storage (Etapa 4)
- Buckets privados `lost-items` e `task-attachments` já existiam no destino (não foram recriados).
- `lost-items`: **4.427 / 4.427 arquivos** copiados, com os mesmos caminhos/nomes — 0 divergências (lista comparada arquivo a arquivo).
- `task-attachments`: 0 arquivos na origem, nada a copiar.
- Nenhum arquivo foi removido da origem. Policies de storage aplicadas pelo `01_estrutura.sql`.

## 5. Dependências ainda existentes do backend atual
- Aplicação em produção continua 100% apontada para o Cloud atual (`.env` inalterado).
- Edge Functions ainda não foram publicadas no destino (`migracao/04-deploy-functions.sh`).
- Segredos das funções (RESEND_API_KEY, etc.) ainda não cadastrados no destino.
- Cron jobs (`migracao/05-cron.sql`) ainda não criados no destino.

## 6. Procedimento recomendado para a sincronização final (antes da virada)
1. Avisar os usuários e colocar o sistema em janela de baixo uso.
2. Rodar novamente a cópia (é UPSERT idempotente) apenas para as tabelas transacionais, ou completa — leva poucos minutos, exceto `lost_items_archive`.
3. Recopiar arquivos novos do bucket `lost-items` (comparação por lista, só os ausentes).
4. Rodar a migração de usuários de novo (cria apenas os que não existem).
5. Rodar a conferência tabela a tabela até divergência 0.
6. Publicar as Edge Functions, segredos e cron no destino.
7. Trocar as variáveis `VITE_SUPABASE_*` para o novo projeto e validar login + módulos principais.
8. Só então desligar o backend atual.
