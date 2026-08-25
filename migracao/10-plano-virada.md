# Plano de virada — Lovable Cloud → Supabase próprio (`sshyjnyvihdheofjzsca`)

Janela recomendada: fora do horário de aula. Duração estimada: 40–60 min.
Nada aqui foi executado. Este arquivo é o roteiro do dia D.

## Pré-requisitos (antes do dia D)

1. `supabase login`
2. `bash migracao/04-deploy-functions.sh` — publica as 12 Edge Functions
3. `bash migracao/06-configure-secrets.sh` — `RESEND_API_KEY`, `RECURRING_TASKS_CRON_SECRET`
4. Rodar `migracao/05-cron.sql` no SQL editor do destino (jobs ficam **desativados**)
5. Auth do destino: Site URL, Redirect URLs, template de recuperação de senha
6. `bash migracao/07-validacao-destino.sh` → tudo verde

## Dia D — sequência

| # | Passo | Comando / ação |
|---|---|---|
| 1 | Conferir saúde da produção atual | app abrindo, login OK, sem erros no console |
| 2 | Registrar timestamp do corte | `date -u` — anotar |
| 3 | Avisar usuários / congelar cadastros pesados | comunicado interno |
| 4 | Sincronização incremental final | `CONFIRMO_SINCRONIZACAO=SIM bash migracao/08-sincronizacao-final.sh` |
| 5 | Comparar contagens origem x destino | `bash migracao/09-validacao-pos-sincronizacao.sh` (0 divergências) |
| 6 | Conferir registros recentes | abrir últimas demandas, chamados, achados no destino |
| 7 | Copiar arquivos novos do Storage | reexecutar a rotina de cópia de `lost-items` (só arquivos ausentes) |
| 8 | Revalidar Edge Functions / Auth / Storage | `bash migracao/07-validacao-destino.sh` |
| 9 | Trocar o backend da aplicação | apontar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` para o destino |
| 10 | Publicar | publish na Lovable |
| 11 | Testar login | admin faz "esqueci minha senha" → define nova senha em `/change-password` |
| 12 | Testar leitura | dashboard, achados (imagens assinadas), reservas |
| 13 | Testar criação | 1 demanda de teste, 1 chamado de sala pelo formulário público |
| 14 | Testar edição e exclusão autorizada | editar e apagar a demanda de teste |
| 15 | Testar e-mail | atribuir a demanda de teste → e-mail via Resend |
| 16 | Testar rotina recorrente | POST manual em `process-recurring-tasks` com o cron secret |
| 17 | Desativar cron no backend ANTIGO | `update cron.job set active=false where jobname in (...)` |
| 18 | Ativar cron no destino | rodar `migracao/05b-ativar-cron-na-virada.sql` |
| 19 | Monitorar 24–48h | logs de funções, erros do app, execuções de cron |
| 20 | Manter backend antigo intacto | não desligar nada por, no mínimo, 7 dias |

Só depois do período de observação: remover as funções temporárias `export-*-migracao` e a tela `/admin-module/migracao`, e desligar o Lovable Cloud.

## Rollback

Gatilho: falha de login em massa, dados faltando, funções quebradas ou erro sem solução em até 30 min.

1. Restaurar as variáveis anteriores (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` do backend atual).
2. Republicar a aplicação.
3. Desativar os cron jobs no destino: `update cron.job set active=false where jobname in ('expire-lost-items-daily','process-recurring-tasks-daily','process-recurring-tasks-hourly');`
4. Reativar os cron jobs no backend antigo.
5. Confirmar login e leitura no backend antigo.

**Cuidado com os registros criados no destino após a virada:** no rollback eles não existem no backend antigo. Antes de voltar, exportar do destino tudo criado depois do passo 9 (filtro `created_at >= <timestamp da virada>`) e reimportar na origem por UPSERT — o `08-sincronizacao-final.sh` serve invertendo SRC/DST e ajustando `CORTE`. Quanto mais tempo em produção no destino, mais caro é o rollback; decidir rápido.
