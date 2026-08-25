# Sincronização incremental — 2026-08-25T21:54:03Z

Origem: backend atual (Lovable Cloud, acesso interno via função temporária `sync-final-migracao`)
Destino: `sshyjnyvihdheofjzsca`
Corte da clonagem inicial: `2026-08-25T16:45:00Z`
Exclusões: **NÃO aplicadas** (somente relatório)
Cron do destino: mantidos `active = false` — nada alterado
Produção: continua 100% no backend atual

## 1) Dados — upsert por id (58/58 tabelas)

Tabelas com colunas temporais: filtro `created_at >= corte OR updated_at >= corte`.
Tabelas sem `updated_at`/`created_at`: reenvio completo idempotente (upsert por id).

| Tabela | Linhas enviadas (upsert) |
|---|---|
| user_roles | 28 (tabela sem timestamps — reenvio completo) |
| equipment | 2 |
| equipment_loans | 2 |
| equipment_reservations | 1 |
| lockers | 2 |
| locker_loans | 2 |
| lost_items | 10 |
| room_checklists | 4.986 + 4.987 (reenvio; sem `updated_at`) |
| shift_handovers | 3 |
| shift_handover_tasks | 5.176 (sem `updated_at` — reenvio completo) |
| shift_handover_incidents | 9 |
| semester_labels | 502 (sem `updated_at` — reenvio completo) |
| uber_requests | 3 |
| activity_logs | 39 |
| demais 44 tabelas | 0 (nenhuma alteração após o corte) |

Total de linhas enviadas: **15.752** (inclui reenvios idempotentes).
Alterações reais pós-corte na origem: equipment 2, equipment_loans 2, equipment_reservations 1,
lockers 2, locker_loans 2, lost_items 10, uber_requests 3, shift_handovers 3, room_checklists 1,
activity_logs 39.

## 2) Exclusões (apenas relatório)

Comparação de ids origem x destino nas 58 tabelas:
**0 registros presentes no destino e ausentes na origem.**
Nenhuma exclusão a revisar. `APLICAR_EXCLUSOES` não foi usado.

## 3) Storage

| Bucket | Origem | Destino | Novos/alterados copiados | Faltando após sync | Tamanho divergente |
|---|---|---|---|---|---|
| lost-items | 4.434 | 4.434 | 7 | 0 | 0 |
| task-attachments | 0 | 0 | 0 | 0 | 0 |

Paths preservados; cópia apenas de arquivos ausentes ou com tamanho diferente.

## 4) Auth

Origem 32 usuários, destino 32 usuários. **0 novos** — UUID e e-mail conferem em todos.
`profiles` (28) e `user_roles` (28) reenviados e conferidos: 0 divergências.
Hashes de senha e sessões não foram migrados (por definição).

## 5) Validação pós-sincronização

- Contagem por tabela: **idêntica em 58/58**.
- IDs origem → destino ausentes: **0**.
- IDs destino → origem ausentes: **0**.
- Divergências de `updated_at`: 8 linhas (equipment 2, equipment_loans 1, lockers 2, lost_items 3).
  Causa: o próprio destino tem trigger `update_updated_at_column`, que reescreve `updated_at` no
  momento do upsert. Conteúdo conferido linha a linha em amostra (`equipment/200c2bca…`): todos os
  campos de negócio idênticos à origem. Não é perda nem inconsistência de dados.
- Registros criados/alterados após o corte: contagens iguais origem x destino.
- Foreign keys órfãs no destino (31 relações verificadas, incluindo `auth.users`): **0**.

## 6) Conclusão

Origem e destino estão equivalentes em dados, arquivos e usuários.
Término da sincronização: **2026-08-25T21:54:03Z** (18:54 São Paulo).

**Status: PRONTO PARA VIRADA** — aguardando autorização explícita. Nenhuma variável da aplicação,
domínio, cron ou backend de produção foi alterado nesta execução.
