# Migração do backend para a sua conta Supabase

Este kit move banco, autenticação, arquivos e funções do Lovable Cloud para um projeto Supabase da **sua** conta, mantendo o Lovable apenas como frontend/editor.

> Ordem obrigatória: criar projeto novo → copiar tudo → apontar o app → testar → só então desligar o Cloud.
> Desligar o Lovable Cloud é **irreversível** e apaga banco, storage e funções de lá.

## Pré-requisitos (na sua máquina)

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalada (`supabase --version`)
- PostgreSQL client 15+ (`pg_dump`, `psql`)
- Node 18+ (para os scripts `.mjs`)
- Projeto novo criado em https://supabase.com (região São Paulo, plano com espaço para ~1 GB)

## Variáveis de ambiente

Crie um arquivo `migracao/.env.migracao` (NÃO comitar) com:

```bash
# ORIGEM (Lovable Cloud) – peça as credenciais no chat do Lovable / Cloud → Advanced
export SRC_DB_URL="postgresql://postgres:SENHA@db.<ref-origem>.supabase.co:5432/postgres"
export SRC_URL="https://<ref-origem>.supabase.co"
export SRC_SERVICE_KEY="<service_role da origem>"

# DESTINO (sua conta) – projeto já criado
export DST_DB_URL="postgresql://postgres:SENHA@db.sshyjnyvihdheofjzsca.supabase.co:5432/postgres"
export DST_URL="https://sshyjnyvihdheofjzsca.supabase.co"
export DST_SERVICE_KEY="<service_role do destino>"   # Settings → API → service_role
export DST_REF="sshyjnyvihdheofjzsca"
```

> A chave **publicável** do destino (`sb_publishable_...`) não entra aqui: ela é gravada
> automaticamente no `.env` do frontend quando você conecta o projeto em Connectors.

Carregue com `source migracao/.env.migracao` antes de cada script.

## Passo a passo

| # | Comando | O que faz |
|---|---------|-----------|
| 0 | `bash migracao/00-preflight.sh` | Confere ferramentas, variáveis e conexão com os dois bancos |
| 1 | `bash migracao/01-export.sh` | Gera dumps de `public`, `auth` e `storage` em `migracao/dump/` |
| 2 | `bash migracao/02-import.sh` | Restaura estrutura + dados no projeto destino |
| 3 | `node migracao/03-storage-copy.mjs` | Copia os arquivos dos buckets `lost-items` e `task-attachments` |
| 4 | `bash migracao/04-deploy-functions.sh` | Publica as 13 edge functions e lembra dos segredos |
| 5 | `psql "$DST_DB_URL" -f migracao/05-cron.sql` | Recria os agendamentos (expiração 60 dias, tarefas recorrentes) |
| 6 | `node migracao/06-verify.mjs` | Compara contagem de linhas tabela a tabela entre origem e destino |
| 7 | — | Trocar a conexão do app (veja abaixo) e rodar o checklist de testes |
| 8 | — | Só depois de tudo OK: Cloud → Advanced → Disconnect |

> Roteiro marcável, passo a passo, em [`07-checklist-virada.md`](./07-checklist-virada.md).

## Passo 7 – apontar o app para o seu Supabase

1. No Lovable, abra **Connectors → Supabase** e conecte a sua conta / selecione o projeto destino.
2. O Lovable regrava `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`) e o arquivo de tipos.
3. Nenhum código de tela muda: todos os hooks continuam importando `@/integrations/supabase/client`.
4. Em **Authentication → URL Configuration** do projeto destino, cadastre:
   - Site URL: `https://vegsystem.site`
   - Redirect URLs: `https://vegsystem.site/**`, `https://vegsystem.lovable.app/**`, URL de preview do Lovable
5. Em **Authentication → Providers**, replique o que estiver ativo hoje (e-mail/senha; Google se usado).
6. Em **Database → Replication**, habilite Realtime para as tabelas que o app escuta (ver `src/hooks/useRealtimeSubscription.ts`).

## Segredos das edge functions (cadastrar no destino)

`RESEND_API_KEY`, `RECURRING_TASKS_CRON_SECRET`, `LOVABLE_API_KEY` (se ainda usada).
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase.

## Checklist de testes (passo 7)

- [ ] Login interno + troca de senha obrigatória
- [ ] Portal do cliente (`/portal-cliente`): cadastro, aprovação, nova reserva
- [ ] Chamado de sala público (`/chamado-sala`) → aparece na lista interna com alarme
- [ ] Achados e perdidos: listar, cadastrar com foto, abrir imagem (URL assinada)
- [ ] Empréstimos: criar, devolver, alterar data prevista
- [ ] Reservas: criar, calendário, página pública `/painel-reservas`
- [ ] Checklists: preencher, exportar período, limpar período
- [ ] Checklist semestral: preencher e travar
- [ ] Processo seletivo: importar candidatos, assinatura, PDFs
- [ ] Uber corporativo: `/solicitar-uber` e recibo
- [ ] Etiquetas: gerar PDF
- [ ] Histórico de atividades registrando novas ações

## Rollback

Enquanto o Cloud não for desligado, basta reconectar o projeto antigo em Connectors. Depois do desligamento, o único recurso é o conteúdo de `migracao/dump/` — guarde essa pasta em local seguro.

---

## Caminho ATIVO: migração por dentro do Cloud

As credenciais da origem (`SRC_DB_URL`, `SRC_SERVICE_KEY`) **não são acessíveis** no Lovable Cloud.
Por isso os scripts `01-export.sh`, `02-import.sh`, `03-storage-copy.mjs` e `06-verify.mjs` ficam como
**alternativos** — só servem se você conseguir a credencial de banco da origem com o suporte.

O caminho ativo usa três funções temporárias que rodam dentro do backend atual e escrevem no destino
com a service key **do destino** (segredo `DST_SERVICE_KEY`).

### Passo a passo

1. No projeto destino, SQL Editor: aplicar `migracao/dump/01_estrutura.sql`
   (replay cronológico das 128 migrações — recria tabelas, enums, funções, triggers, RLS e GRANTs).
2. No destino, criar os buckets **privados** `lost-items` e `task-attachments`.
3. No Lovable, cadastrar o segredo `DST_SERVICE_KEY` (service role do destino).
4. No sistema, acessar **Administrativo → Migração do backend** (`/admin-module/migracao`) como admin e rodar, na ordem:
   1. Usuários — recria as contas com o mesmo UUID (senhas **não** migram)
   2. Dados das tabelas — 59 tabelas, ordem de dependência, páginas de 500 (100 nas tabelas pesadas)
   3. Arquivos — buckets copiados em levas de 50
   4. Conferência — contagem de linhas origem x destino
5. Publicar as edge functions no destino (`04-deploy-functions.sh`) e cadastrar `RESEND_API_KEY` e `RECURRING_TASKS_CRON_SECRET`.
6. Rodar `05-cron.sql` no destino.
7. Seguir `07-checklist-virada.md` a partir do item de `GRANT EXECUTE ... TO anon`.
8. Depois de tudo verde: conectar o projeto novo em Connectors, testar, remover as funções
   `export-migracao`, `export-storage-migracao`, `export-users-migracao`, a página `/admin-module/migracao`
   e o segredo `DST_SERVICE_KEY`. Só então desligar o Cloud.

### Senhas

`auth.users` não expõe hashes por API. Todos os usuários precisarão usar
"esqueci minha senha" no primeiro acesso ao novo backend. Avise a equipe antes da virada.
