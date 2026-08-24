# Migrar o backend para a sua conta Supabase

Objetivo: manter o Lovable apenas como frontend/editor e passar banco, autenticação, arquivos e funções para um projeto Supabase da sua própria conta.

## Antes de começar (importante)

- Desconectar o Lovable Cloud é **irreversível** e apaga banco, storage e funções do Cloud. Só faremos isso depois que o novo projeto estiver funcionando e validado.
- A ordem correta é: criar o novo projeto → copiar tudo → apontar o app para ele → testar → só então desligar o Cloud.
- Alguns passos precisam ser feitos por você na sua conta Supabase (criar projeto, rodar comandos de export/import, colar chaves). Eu preparo os scripts e o código.

## O que precisa ser migrado

- 59 tabelas, enums, funções e triggers (128 arquivos de migração já versionados no projeto)
- Políticas de acesso (RLS) e GRANTs de todas as tabelas
- Dados atuais (~424 MB), incluindo achados e perdidos, demandas, reservas, processo seletivo
- Usuários e senhas da autenticação
- Arquivos de storage: `lost-items` (privado) e `task-attachments`
- 13 funções de servidor (criação de usuários, PDFs, notificações, chamados, tarefas recorrentes)
- Agendamentos automáticos (expiração de achados em 60 dias, tarefas recorrentes)
- Segredos das funções (ex.: chave do serviço de e-mail)

## Etapas

1. **Preparação**: você cria o projeto novo na sua conta Supabase (mesma região, plano compatível com ~1 GB de dados) e me passa URL + chave pública; a chave de serviço fica só nos segredos.
2. **Estrutura**: aplicar todo o histórico de migrações no projeto novo e conferir que enums, funções, triggers, RLS e GRANTs bateram com o original.
3. **Dados**: dump e restore completo (incluindo o esquema de autenticação, para preservar usuários e senhas) e conferência de contagem de linhas tabela a tabela.
4. **Arquivos**: copiar os dois buckets com as mesmas configurações de privacidade e recriar as políticas de acesso; validar as URLs assinadas das imagens de achados e perdidos.
5. **Funções e agendamentos**: publicar as 13 funções no projeto novo, recadastrar os segredos e recriar os jobs agendados.
6. **Trocar a conexão do app**: substituir a integração do Lovable Cloud pela conexão com o seu Supabase e atualizar as variáveis do frontend.
7. **Testes completos**: login interno, portal do cliente, chamados de sala públicos, achados e perdidos com imagens, empréstimos, reservas (interna e página pública), checklists com exportação, processo seletivo e Uber corporativo.
8. **Desligar o Cloud**: só após tudo validado, desativar o Lovable Cloud (Cloud → Advanced → Disconnect), com backup guardado antes.

## Detalhes técnicos

- Export/import via `pg_dump`/`psql` com `--schema=public --schema=auth --schema=storage` e restauração na ordem estrutura → dados.
- Manter os mesmos UUIDs de usuários é obrigatório: várias tabelas (`profiles.user_id`, `user_roles`, `tasks`, `activity_logs`) referenciam `auth.users`.
- `src/integrations/supabase/client.ts` e o arquivo de tipos passam a ser gerados pela conexão externa; o import `@/integrations/supabase/client` continua igual, sem mudanças nos hooks.
- Funções `SECURITY DEFINER` usadas pelas páginas públicas (`create_public_classroom_call`, `create_public_uber_request`, `get_public_reservations`, `ps_public_*`) precisam ser revalidadas com `anon` após o restore.
- Cron: recriar `expire-lost-items-daily` e `process-recurring-tasks` via `pg_cron`/`pg_net` no projeto novo.
- Buckets: `lost-items` privado com URLs assinadas (TTL 6h) e `task-attachments` conforme a política atual.

## Riscos

- Janela de indisponibilidade curta na virada (recomendado fora do horário de aula).
- Se o restore de `auth` falhar, os usuários precisariam redefinir senha — por isso testamos login antes de desligar o Cloud.
- Depois do desligamento não há volta; o backup local é a única rede de segurança.
