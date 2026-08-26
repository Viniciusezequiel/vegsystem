# Auditoria funcional autenticada — 2026-08-26

## Escopo e controles

- Produção: `https://www.vegsystem.site`
- Supabase confirmado: `sshyjnyvihdheofjzsca`
- Contas usadas: somente E2E `assistente` e E2E `admin`, fornecidas por variáveis de ambiente.
- As quatro variáveis E2E estavam presentes; seus valores não foram impressos nem persistidos no repositório.
- `PROD_DATABASE_URL` estava ausente e nenhuma credencial privilegiada foi usada.
- Execução serial, `storageState` separado por role e artefatos Playwright (trace, screenshot e vídeo) desativados.
- Run ID da execução integral: `__E2E__1787762402944`.
- Registro final de fixtures: nenhuma linha e nenhum objeto Storage.

## Resultado por teste

| MÓDULO | CONTA/ROLE | TESTE | RESULTADO | ERRO | CAUSA PROVÁVEL | FIXTURE CRIADO | CLEANUP OK |
|---|---|---|---|---|---|---|---|
| Autenticação | assistente/admin/anônimo | Login das duas contas, sessão após reload e guards por role | OK | — | — | Não | Sim |
| Permissões | assistente/admin | `is_internal_user`, `is_admin` e `has_role` | OK | — | — | Não | Sim |
| Equipamentos | assistente/admin | Listagem e acesso admin a `/equipment/loans` por role | OK | — | — | Não | Sim |
| Equipamentos | assistente/admin | Criar, atualizar e devolver empréstimo | NÃO EXECUTADO POR SEGURANÇA | Nenhum equipamento E2E dedicado | Alteraria disponibilidade de equipamento real | Não | Sim |
| Reservas | assistente | Leitura de reservas e salas ativas | OK | — | — | Não | Sim |
| Reservas | assistente/admin | Criar, editar, testar conflito próprio e excluir | NÃO EXECUTADO POR SEGURANÇA | Nenhuma sala/agenda dedicada a E2E | Poderia afetar agenda real | Não | Sim |
| Autenticação | assistente | Logout e remoção da sessão | OK | — | — | Não | Sim |
| Rotas públicas | anônimo | `/admin-auth` | OK | — | — | Não | Sim |
| Rotas públicas | anônimo | `/chamado-sala` | OK | — | — | Não | Sim |
| Rotas públicas | anônimo | `/painel-reservas` | OK | — | — | Não | Sim |
| Rotas públicas | anônimo | `/solicitar-uber` | OK | — | — | Não | Sim |
| Guards | anônimo | `/`, `/lost-found`, `/equipment`, `/reservations`, `/tasks`, `/classroom-calls`, `/admin-module` e `/admin-module/uber` redirecionam ao login | OK (8 testes) | — | — | Não | Sim |
| Frontend | anônimo | Rota inexistente mostra 404 da SPA | OK | — | — | Não | Sim |
| Chamados de sala | anônimo | Catálogos públicos respondem | OK | — | — | Não | Sim |
| Chamados de sala | anônimo | Consulta de código inexistente não expõe chamado | OK | — | — | Não | Sim |
| Edge Functions | anônimo | Função pública de configuração responde | OK | — | — | Não | Sim |
| Edge Functions | anônimo | `create-user`, `delete-user`, `reset-password`, `process-recurring-tasks` e `update-user-email` rejeitam anônimo | OK (5 testes) | — | — | Não | Sim |
| Storage | anônimo | `lost-items` e `task-attachments` rejeitam leitura pública | OK (2 testes) | — | — | Não | Sim |
| Achados e Perdidos | assistente/admin | Upload, path sem Base64, signed URL, edição, baixa, bloqueio RLS e exclusão admin explícita | OK | RLS de DELETE negado retorna HTTP sem erro e zero linhas; teste validou `data = []` | Comportamento normal do PostgREST/RLS, não defeito funcional | 1 linha + 1 objeto | Sim |
| Uber Corporativo | assistente/admin | Criar, negar leitura/atualização ao assistente, ler/atualizar/remover como admin | OK | RLS de UPDATE negado retorna zero linhas sem erro | Comportamento normal do PostgREST/RLS, não defeito funcional | 1 linha | Sim |
| Tarefas/Storage | assistente/admin | Criar, editar, concluir, negativa por RLS, upload/signed URL/delete de anexo | OK COM LIMITAÇÃO | `task_history` não foi comprovado por UI | O histórico é inserido pelo hook do frontend, não por trigger; o teste controlado usou API normal diretamente | 1 linha + 1 objeto | Sim |

## Execuções técnicas

- Validação Playwright: 31 testes descobertos.
- Fase autenticada somente leitura: **5/5 aprovados**.
- Fase pública/anônima: **23/23 aprovados**.
- Escrita controlada: **3/3 módulos aprovados**, primeiro isoladamente e depois na suíte integral.
- `npm run build`: **aprovado**. Há apenas os avisos já existentes de chunk principal acima de 500 kB e importação mista de `sonner`.
- `git diff --check`: **aprovado**.
- `npm run test:e2e` integral: **31/31 aprovados**, em série e sem retries.

## Resumo

- Testes planejados/descobertos: **31**.
- Testes executados na suíte integral: **31**.
- Aprovados: **31**.
- Falhos funcionais: **0**.
- Bloqueados: **0** após autorização explícita.
- Fluxos de escrita ignorados por segurança: **2** (empréstimos e reservas).
- Dados E2E restantes: **0**.
- Objetos Storage restantes: **0**.
- Problemas P0: **0 encontrados na parte executada**.
- Problemas P1: **0 encontrados**.
- P2: empréstimos e reservas precisam de recursos dedicados para testes sem impacto operacional; a criação automática de `task_history` ainda precisa de um teste via UI; em Achados, persistência do path e signed URL foram comprovadas após nova leitura, mas a renderização visual da imagem após reload não foi automatizada nesta rodada.

## Fixtures criadas e removidas

Execução integral `__E2E__1787762402944`:

| Recurso | ID/path criado | ID/path removido |
|---|---|---|
| `lost_items` | `a81a1832-2910-4927-8ea8-38e78cedb1b9` | o mesmo |
| `uber_requests` | `b9912165-9679-403c-981c-0c53565d6538` | o mesmo |
| `tasks` | `1b7fde89-7ea4-47b8-a59d-4ea54a44d9a4` | o mesmo |
| `lost-items` | `e2e/__E2E__1787762402944/lost-item.png` | o mesmo |
| `task-attachments` | `e2e/__E2E__1787762402944/task.txt` | o mesmo |

Execuções isoladas anteriores, também limpas:

| Run | Recurso | ID/path criado e removido |
|---|---|---|
| `__E2E__1787762330270` | `lost_items` | `b578f55d-d924-472e-8de4-89f4f7708618` |
| `__E2E__1787762330270` | `lost-items` | `e2e/__E2E__1787762330270/lost-item.png` |
| `__E2E__1787762351448` | `uber_requests` | `96921a3a-697b-44d8-97e7-c719ef94002b` |
| `__E2E__1787762368273` | `tasks` | `ceaee2ec-c4b2-43d8-9a0e-30cb6610d210` |
| `__E2E__1787762368273` | `task-attachments` | `e2e/__E2E__1787762368273/task.txt` |

Houve uma primeira tentativa de Achados com o run `__E2E__20260826_1787762248151`, antes de o registro histórico de IDs ter sido acrescentado. O teardown confirmou listas ativas vazias; o path `e2e/__E2E__20260826_1787762248151/lost-item.png` foi removido. O UUID daquela tentativa não ficou preservado no log após o cleanup.

Confirmação final do registro do teardown:

- **registros E2E restantes = 0**
- **objetos Storage E2E restantes = 0**

Nenhum `DELETE` amplo, filtro `LIKE`, `TRUNCATE`, `service_role`, alteração de policy/RLS ou mutação de registro preexistente foi usado.
