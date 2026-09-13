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
- prévia/checklist de encerramento.

## Bloqueado enquanto o módulo atual estiver em uso

O V2 não deve executar nenhuma destas ações sem uma ativação futura controlada:

- publicar proposta na equipe oficial (`ps_event_collaborators`);
- enviar/reprocessar comunicação oficial;
- registrar ou alterar presença/ausência;
- criar, retificar ou excluir avaliações oficiais;
- alterar pagamentos, valores liquidados ou status financeiro;
- finalizar/reabrir evento oficial;
- aplicar migration/RPC que escreva nas tabelas operacionais do módulo atual.

## Banco V2

As migrations de estrutura V2 permanecem sem aplicação em produção durante esta fase. A migration de publicação da alocação deve permanecer desativada até a migração controlada do módulo oficial.

## Regra de transição futura

A ativação operacional deve ser feita por etapa, com backup, validação de dados e teste de regressão do módulo atual antes de cada escrita compartilhada.
