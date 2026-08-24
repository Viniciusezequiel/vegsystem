# Virada para o seu Supabase (projeto sshyjnyvihdheofjzsca)

Projeto de destino confirmado: `https://sshyjnyvihdheofjzsca.supabase.co`, ainda vazio.
Chave publicável nova (`sb_publishable_...`) recebida. A `service_role` fica só no seu arquivo local `migracao/.env.migracao` e nos segredos do projeto novo — nunca no código nem no chat.

## Situação atual

O kit de migração já está pronto em `migracao/` (export, import, storage, funções, cron, verificação). Como o projeto novo está vazio, a ordem é: copiar tudo → apontar o app → testar → só então desligar o Cloud.

## O que eu faço agora no código

1. Preencher o kit com os dados reais do destino:
   - `migracao/README.md`: exemplo de `.env.migracao` já com `DST_URL=https://sshyjnyvihdheofjzsca.supabase.co` e `DST_REF=sshyjnyvihdheofjzsca`.
   - `migracao/05-cron.sql`: trocar `<DST_REF>` pela referência real (restam apenas a service_role e o cron secret para você colar).
   - `migracao/04-deploy-functions.sh`: `DST_REF` com valor padrão já preenchido.
2. Criar `migracao/07-checklist-virada.md`: roteiro curto e ordenado da virada, com os pontos que dependem do painel do Supabase (URL Configuration, providers, Realtime) e o critério de "pode desligar o Cloud".
3. Criar `migracao/00-preflight.sh`: valida antes de começar que `pg_dump`, `psql`, `node` e a CLI do Supabase existem e que `SRC_DB_URL`/`DST_DB_URL` conectam — evita descobrir o problema no meio do restore.

## O que depende de você (na sua máquina / sua conta)

1. Criar `migracao/.env.migracao` com as 7 variáveis (o README traz o modelo).
2. Rodar, na ordem: `00-preflight.sh` → `01-export.sh` → `02-import.sh` → `03-storage-copy.mjs` → `04-deploy-functions.sh` → `05-cron.sql` → `06-verify.mjs`.
3. No Lovable, **Connectors → Supabase**, conectar sua conta e selecionar o projeto novo. Isso regrava `.env` e o arquivo de tipos automaticamente — nenhum import de tela muda.
4. No projeto novo: cadastrar Site URL / Redirect URLs, replicar os providers de login, habilitar Realtime nas tabelas usadas e cadastrar os segredos das funções (`RESEND_API_KEY`, `RECURRING_TASKS_CRON_SECRET`).
5. Rodar o checklist de testes do README.
6. Só com tudo verde: desligar o Lovable Cloud (irreversível).

## Detalhes técnicos

- A chave publicável nova (`sb_publishable_...`) substitui a antiga `anon` JWT; o cliente Supabase JS aceita as duas no mesmo parâmetro, então `src/integrations/supabase/client.ts` não muda.
- O `.env` do frontend é regravado pela conexão em Connectors — não vou editá-lo à mão.
- O restore de `auth.users`/`auth.identities` preserva os UUIDs, que são referenciados por `profiles.user_id`, `user_roles`, `tasks` e `activity_logs`.
- As funções `SECURITY DEFINER` públicas (`create_public_classroom_call`, `create_public_uber_request`, `get_public_reservations`, `ps_public_*`) precisam de `GRANT EXECUTE ... TO anon` revalidado após o restore — incluo essa checagem no `07-checklist-virada.md`.
- Buckets `lost-items` e `task-attachments` continuam privados, com URLs assinadas de 6h.

## Riscos

- Janela curta de indisponibilidade na virada; melhor fora do horário de aula.
- Se o restore de `auth` falhar, os usuários teriam de redefinir senha — por isso o login é testado antes de desligar o Cloud.
- Depois do desligamento não há volta; `migracao/dump/` é a única rede de segurança.
