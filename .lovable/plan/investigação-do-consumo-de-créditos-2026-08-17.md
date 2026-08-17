# Investigação do consumo de créditos

## O que os dados mostram

Período atual (25/jul a 25/ago) — 216,90 créditos usados:

| Item | Créditos |
|---|---|
| Cloud compute large (instância do backend) | 116,60 |
| Mensagens de build | 80,80 |
| Egress (tráfego de dados) | 17,10 |
| Realtime / storage / functions / worker | ~1,40 |
| Mensagens de plan | 1,00 |

Período anterior (25/mai a 25/jul, dois meses) — 147,51 créditos:

| Item | Créditos |
|---|---|
| Mensagens de build | 102,50 |
| Cloud compute large | 36,91 |
| Egress | 7,21 |
| Demais itens | ~0,9 |

Conclusão: o salto não veio de mensagens de IA (elas até caíram). Veio da **instância de banco no tamanho "large"**, que passou a rodar 24/7 e agora custa ~117 créditos por mês sozinha — mais da metade de todo o consumo. O egress também mais que dobrou, mas é secundário (~17 créditos).

## A instância está superdimensionada

Snapshot atual de saúde do banco:

- Memória: 18% usada
- Conexões: 29 de 160
- Clientes do pool: 12 de 800
- Disco de dados: 9% usado
- Reinícios desde o boot: 0

Nenhum indicador chega perto do limite. O "large" foi provavelmente ativado durante os problemas de lentidão/tela preta — que na verdade eram bugs de realtime já corrigidos, não falta de CPU.

## Plano

1. **Reduzir o tamanho da instância** (principal economia). Proponho descer para um tamanho menor via aprovação no chat e monitorar. Se aparecer qualquer sinal de saturação, subimos de novo — o redimensionamento leva alguns minutos e não perde dados.
2. **Reduzir o egress**, sem tirar funcionalidade:
   - Limitar o prefetch global de imagens de Achados e Perdidos: hoje ele baixa URLs de até 100 itens a cada sessão. Passar a prefetchar apenas o que está visível e manter o cache de URLs assinadas por mais tempo.
   - Aumentar o TTL do cache de URLs assinadas (1h → 6h) para cortar chamadas repetidas de assinatura.
   - Arquivar/paginar `activity_logs` e o histórico de checklists (tabelas grandes lidas inteiras em algumas telas).
3. **Mensagens de IA**: pedidos pontuais custam bem menos que "revise tudo o projeto". Isso já é a menor parte do problema hoje.

## Detalhes técnicos

- Redimensionamento feito pela ferramenta de compute do Lovable Cloud (com card de aprovação) ou em Backend > Configurações avançadas > Atualizar instância.
- Ajustes de egress ficam em `src/components/GlobalPrefetch.tsx`, `src/lib/storageUrl.ts`, `src/hooks/useRooms.ts` e `src/hooks/useActivityLogs.ts`.
- Nenhuma alteração de schema, RLS ou fluxo de uso.
