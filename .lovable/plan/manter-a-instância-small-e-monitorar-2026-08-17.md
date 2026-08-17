# Manter a instância Small e monitorar

## Decisão

Manter o backend no tamanho **Small**. Nenhuma alteração de código, schema ou infraestrutura será feita agora.

## Situação atual

- Memória: 41% · Conexões: 31/90 · Pool: 25/400
- Disco: 9% · Banco: 424 MB · Reinícios desde o boot: 0

## Consumo esperado por mês (backend)

| Item | Antes (large) | Agora (small) |
|---|---|---|
| Compute 24/7 | ~117 | ~25-30 |
| Egress | ~17 | ~6-9 |
| Realtime / storage / functions | ~1,5 | ~1 |
| Total | ~135 | ~35-40 |

O restante da fatura passa a depender das mensagens de build/plan.

## Próximo passo (sem ação agora)

Reavaliar em 1-2 semanas com um novo snapshot de saúde do banco:

- Memória estável abaixo de ~30% e sem reinícios: avaliar o tamanho Micro.
- Memória acima de ~70%, reinícios ou lentidão em pico: voltar para um tamanho maior.

Se em algum momento você quiser cortar mais egress, os candidatos são arquivar `activity_logs` e paginar o histórico de checklists — fica como plano separado.
