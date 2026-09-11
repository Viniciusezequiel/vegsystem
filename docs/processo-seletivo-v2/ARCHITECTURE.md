# Processo Seletivo 2 — fundação

Esta pasta documenta a evolução paralela do Processo Seletivo 2. O módulo atual permanece operacional durante todo o desenvolvimento.

## Princípios

- reutilizar dados e regras estáveis do módulo atual sempre que possível;
- evitar alteração destrutiva em tabelas ou rotas existentes durante a construção;
- manter a sidebar global enxuta e concentrar a navegação do processo dentro da própria central;
- criar e validar cada etapa antes de substituir o módulo atual;
- não publicar alocações automáticas sem revisão humana;
- suportar criação manual e importação de planilha alimentando a mesma estrutura interna;
- tratar responsividade, loading, erro, confirmação, salvar, cancelar e alterações não salvas como requisitos do fluxo, não como acabamento posterior.

## Hierarquia física prevista

Local → Prédio → Andar → Área → Ambiente.

Área cobre estruturas que não são salas, como corredor, banheiro, entrada, recepção, apoio e outros pontos operacionais. Cada nível poderá receber necessidades próprias de equipe.

## Alocação futura

A alocação será gerada como proposta. O motor deverá considerar elegibilidade por função, bloqueios, histórico de atuação, experiência, avaliação, disponibilidade, distribuição equilibrada e regras específicas do evento. O usuário poderá revisar, substituir e travar alocações antes da publicação.

## Estratégia de publicação

A branch `feat/processo-seletivo-v2` concentra o desenvolvimento. Alterações devem ser agrupadas por etapa para evitar deploys de preview sucessivos e desnecessários.
