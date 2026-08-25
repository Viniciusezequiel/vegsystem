# Janela final de virada — relatório

Origem: backend Lovable Cloud atual · Destino: `sshyjnyvihdheofjzsca`
Marco do delta (corte): `2026-08-25T21:54:03Z`

## Etapa 1 — Origem em somente leitura
- Entrada em somente leitura: **2026-08-25T23:16:14Z**
- Snapshot de permissões salvo em `public._grants_backup_virada`: **342 grants**
- Grants de INSERT/UPDATE/DELETE para `anon`/`authenticated` no schema public: **0** (verificado)
- `storage.objects`: escrita revogada de `anon`/`authenticated` (não havia grants diretos previamente)
- `service_role` intacto · SELECT, dados, estrutura, usuários e arquivos preservados
- Reversível pela seção 3 de `migracao/11-janela-manutencao-origem.sql`

## Etapa 2 — Último delta (UPSERT idempotente)
Registros enviados por tabela (somente tabelas com envio):

| tabela | registros |
|---|---|
| user_roles | 28 |
| equipment | 1 |
| lost_items | 5 |
| equipment_loans | 1 |
| classroom_calls | 1 |
| room_checklists | 4.999 * |
| shift_handover_incidents | 9 |
| shift_handover_tasks | 5.176 * |
| semester_labels | 502 * |
| activity_logs | 27 |
| **total** | **10.749** |

`*` tabelas sem colunas temporais utilizáveis no filtro: reenviadas integralmente por UPSERT (idempotente).
Demais 48 tabelas: 0 alterações após o corte.

- Auth: origem 32 / destino 32 · **0 novos usuários**
- Storage `lost-items`: **2 arquivos novos copiados** → total **4.436** em ambos
- Storage `task-attachments`: 0 arquivos em ambos
- Exclusões: **nenhuma aplicada** (somente relatório)

## Etapa 3 — Validação final
- Tabelas comparadas: **58/58** — contagem idêntica em 57; `activity_logs` origem 8.738 / destino 8.739
- IDs só na origem (faltando no destino): **0**
- IDs só no destino: **1** (`activity_logs` `ed43c9ec-8b36-43d8-9f4d-a09bf98adc3e`, log gerado pelos testes no ambiente novo)
- Registros divergentes: **12** (lockers 2, equipment 3, lost_items 6, equipment_loans 1) — comparação campo a campo confirmou divergência **apenas em `updated_at`**, gerada pelos triggers do destino no momento do UPSERT. Dados de negócio idênticos.
- Auth: 32/32, 0 faltando, 0 e-mails divergentes
- Storage: `lost-items` 4.436/4.436, 0 faltando, 0 tamanhos divergentes; `task-attachments` 0/0
- Foreign keys órfãs: **0** em 29/29 relacionamentos verificados
- Pós-corte: origem e destino equivalentes

## Etapas 4/5
- DNS, `vegsystem.site`, Vercel e domínio Lovable: **não alterados**
- Cron da origem: **preservado** · Cron do destino: **permanece `active = false`** (`05b` não executado)
- Backend antigo: intacto, disponível para rollback
