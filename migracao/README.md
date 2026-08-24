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
