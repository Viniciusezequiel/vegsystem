# Processo Seletivo V2 — limite seguro de integração

Este documento registra o limite operacional do V2 enquanto o Processo Seletivo atual permanecer como ambiente oficial.

## Concluído no V2 sem alterar a operação oficial

- central do evento e workflow operacional;
- estrutura física, necessidades e modelos por andar;
- matriz de elegibilidade;
- motor de alocação, ranking, troca manual e bloqueio de escolhas;
- preparação, auditoria de candidatos/salas e etiquetas;
- prontidão operacional;
- pendências por pessoa, links públicos e atividades recentes;
- leitura de comunicação, treinamentos, presença, avaliações e financeiro;
- relatórios e exportações locais em XLSX;
- prévia/checklist de encerramento;
- auditoria de pré-integração (dry-run) comparando proposta V2 e equipe oficial;
- validação de cobertura de elegibilidade para funções sensíveis;
- exportação local da simulação de integração em CSV;
- barreira explícita em código impedindo publicação da equipe oficial pelo V2.

## Banco V2 ativo e isolado

A migration `ps_v2_structure_foundation` foi aplicada ao banco de produção porque cria exclusivamente estruturas `ps_v2_*` e não altera registros ou comportamento do módulo atual.

Estruturas ativas:

- `ps_v2_locations`;
- `ps_v2_buildings`;
- `ps_v2_floors`;
- `ps_v2_areas`;
- `ps_v2_environments`;
- `ps_v2_event_locations`;
- `ps_v2_staff_requirements`;
- `ps_v2_role_eligibility`;
- `ps_v2_allocation_runs`;
- `ps_v2_allocation_items`.

As tabelas possuem RLS e políticas restritas a usuários internos. No momento da ativação, estavam vazias e sem qualquer impacto nos dados operacionais existentes.

A função/RPC de publicação `ps_v2_publish_allocation_run` **não está instalada no banco**. Portanto, além do bloqueio de interface e do bloqueio de código cliente, não existe caminho de publicação V2 para a equipe oficial nesta fase.

## Bloqueado enquanto o módulo atual estiver em uso

O V2 não deve executar nenhuma destas ações sem uma ativação futura controlada:

- publicar proposta na equipe oficial (`ps_event_collaborators`);
- enviar/reprocessar comunicação oficial;
- registrar ou alterar presença/ausência;
- criar, retificar ou excluir avaliações oficiais;
- alterar pagamentos, valores liquidados ou status financeiro;
- finalizar/reabrir evento oficial;
- aplicar migration/RPC que escreva nas tabelas operacionais do módulo atual.

A constante `PS_V2_OFFICIAL_WRITES_ENABLED` deve permanecer `false` enquanto o módulo atual for o ambiente oficial. Mesmo que alguma interface futura tente chamar a publicação, o cliente bloqueia a operação antes do RPC.

## Dry-run de integração

A tela de pré-integração é somente leitura em relação ao módulo oficial. Ela verifica, entre outros pontos:

- disponibilidade da estrutura V2;
- necessidades e total de vagas planejadas;
- existência e estado da proposta de alocação;
- cobertura da matriz de elegibilidade;
- bloqueio quando funções sensíveis (coordenação, liderança, itinerante, sanitário, detector e organizador geral) não possuem regra ativa;
- revisão pendente, alocação aceita sem colaborador e duplicidades;
- vínculos com necessidades removidas/inativas;
- integrantes já existentes na equipe oficial e quantos seriam novos;
- duplicidades e funções ausentes na equipe oficial;
- conflitos de presença;
- falhas de comunicação e confirmações pendentes;
- treinamentos obrigatórios sem sessão ativa;
- candidatos sem sala ou número de inscrição.

O resultado “tecnicamente pronto” significa apenas que o conjunto de dados passou nas validações locais. Ele não habilita escrita oficial.

## Regra de transição futura

A migration de publicação da alocação permanece desativada. A ativação operacional deve ser feita por etapa, com backup, validação de dados e teste de regressão do módulo atual antes de cada escrita compartilhada.

A primeira etapa futura deverá exigir uma decisão explícita para:

1. instalar a RPC de publicação;
2. revisar a barreira `PS_V2_OFFICIAL_WRITES_ENABLED`;
3. validar o dry-run sem bloqueios;
4. executar teste controlado em um evento não crítico;
5. somente então considerar o V2 como fonte operacional.

Nenhum desses passos deve acontecer automaticamente por deploy.
