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
- exportação local da simulação de integração em CSV;
- barreira explícita em código impedindo publicação da equipe oficial pelo V2.

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

A tela de pré-integração é somente leitura. Ela verifica, entre outros pontos:

- disponibilidade da estrutura V2;
- necessidades e total de vagas planejadas;
- existência e estado da proposta de alocação;
- revisão pendente, alocação aceita sem colaborador e duplicidades;
- vínculos com necessidades removidas/inativas;
- integrantes já existentes na equipe oficial e quantos seriam novos;
- duplicidades e funções ausentes na equipe oficial;
- conflitos de presença;
- falhas de comunicação e confirmações pendentes;
- treinamentos obrigatórios sem sessão ativa;
- candidatos sem sala ou número de inscrição.

O resultado “tecnicamente pronto” significa apenas que o conjunto de dados passou nas validações locais. Ele não habilita escrita oficial.

## Banco V2

As migrations de estrutura V2 permanecem sem aplicação em produção durante esta fase. A migration de publicação da alocação deve permanecer desativada até a migração controlada do módulo oficial.

## Regra de transição futura

A ativação operacional deve ser feita por etapa, com backup, validação de dados e teste de regressão do módulo atual antes de cada escrita compartilhada. A primeira etapa futura deverá remover a barreira somente após uma decisão explícita, nunca de forma automática por deploy.
