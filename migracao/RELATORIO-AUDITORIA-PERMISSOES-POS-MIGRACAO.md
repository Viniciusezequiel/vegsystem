# Relatório de Auditoria de Permissões Pós-Migração

**Destino:** projeto Supabase externo `sshyjnyvihdheofjzsca`
**Origem de referência:** Lovable Cloud (`_grants_backup_virada` + ACLs reais de `pg_class` / `pg_proc`)
**Data:** 2026-08-26
**Status:** auditoria concluída — **nenhum SQL executado no destino**

---

## 1. Metodologia

1. Leitura do snapshot `public._grants_backup_virada` (342 privilégios INSERT/UPDATE/DELETE capturados na origem imediatamente antes da janela somente-leitura).
2. Leitura direta das ACLs residuais da origem em `pg_class.relacl` (SELECT preservado) e `pg_proc.proacl` (EXECUTE por função) — não apenas `information_schema`, que sofre filtro de visibilidade por papel.
3. Sondagem funcional do destino via PostgREST, distinguindo objetivamente:
   - `permission denied for table` → **GRANT ausente**;
   - `new row violates row-level security policy` (42501) → **GRANT existe, RLS bloqueia**;
   - `23502 / 22P02` (NOT NULL, tipo) → **RLS aprovou** (payload propositalmente inválido — nenhum dado gravado).
4. Testes com três identidades: `anon`, usuário autenticado **sem** papel interno e usuário autenticado **com** papel `assistente` (usuário e papel temporários criados e **removidos** ao final; nenhuma linha de negócio foi criada).

---

## 2. Diagnóstico principal (contraintuitivo)

**Os GRANTs de tabela não estão faltando no destino.** Em 31 tabelas sondadas, `anon` e `authenticated` possuem SELECT/INSERT/UPDATE/DELETE; todas as recusas retornaram RLS, nunca "permission denied". As tabelas foram criadas pelo papel `postgres`, então os *default privileges* do Supabase aplicaram os GRANTs automaticamente, compensando a ausência deles no dump `01_estrutura.sql`.

O problema real é o inverso: **o destino está mais permissivo que a origem** em dois eixos, e há um ponto operacional de ambiguidade de RPC.

| # | Achado | Severidade |
|---|--------|-----------|
| A | `anon` possui privilégios em 4 tabelas onde a origem já os havia removido | Alta (exposição) |
| B | Todas as funções `SECURITY DEFINER` ficaram com `EXECUTE` para `PUBLIC` (default do PostgreSQL); o dump não trouxe os `REVOKE`/`GRANT` | Crítica |
| C | `expire_old_lost_items()` — rotina de manutenção que **altera dados** — é executável por `anon` | Crítica |
| D | RPCs sobrecarregadas (`find_available_rooms`, `check_reservation_conflict`) retornam `PGRST203` quando chamadas sem `p_is_external` | Média (funcional) |
| E | Tabela auxiliar `_grants_backup_virada` exposta na Data API | Baixa |
| F | Storage (`lost-items`, `task-attachments`): privado, listagem e URLs assinadas funcionando | OK |

---

## 3. PERMISSÕES AUSENTES NO DESTINO

Comparação objetiva snapshot da origem × destino. **Não foi identificado nenhum privilégio de tabela ausente** — a coluna "Correção" indica remoção de excesso.

### 3.1 Tabelas — privilégios EXCEDENTES no destino

| Objeto | Role | Privilégio antigo (origem) | Privilégio atual (destino) | Policy relacionada | Impacto | Correção |
|---|---|---|---|---|---|---|
| `classroom_calls` | anon | nenhum | SELECT, INSERT, UPDATE, DELETE | policies exigem `is_internal_user()` / RPC pública | Superfície anônima sobre chamados (RLS ainda barra) | `REVOKE ALL ... FROM anon` |
| `ps_evaluations` | anon | nenhum | SELECT, INSERT, UPDATE, DELETE | acesso interno + RPC `ps_public_submit_evaluation` | Avaliações expostas à Data API anônima | `REVOKE ALL ... FROM anon` |
| `ps_event_collaborators` | anon | nenhum | SELECT, INSERT, UPDATE, DELETE | acesso via `ps_public_event_roster` | Roster/assinaturas expostos | `REVOKE ALL ... FROM anon` |
| `uber_requests` | anon | nenhum | SELECT, INSERT, UPDATE, DELETE | criação via `create_public_uber_request` | Solicitações corporativas expostas | `REVOKE ALL ... FROM anon` |
| `_grants_backup_virada` | anon / authenticated | n/a (artefato) | SELECT, INSERT, UPDATE, DELETE | sem RLS | Vazamento do mapa de privilégios | `REVOKE ALL` |

As demais **54 tabelas** têm paridade de DML com o snapshot (`anon`: INSERT+UPDATE+DELETE; `authenticated`: idem). O SELECT foi auditado separadamente pelas ACLs e pelas sondagens REST — **nenhuma alteração de tabela de negócio** além das quatro acima.

### 3.2 Funções — `EXECUTE` divergente

| Objeto | Role | Privilégio antigo | Privilégio atual | Impacto | Correção |
|---|---|---|---|---|---|
| `expire_old_lost_items()` | PUBLIC/anon | apenas `service_role` | EXECUTE (PUBLIC) | **Anônimo pode marcar itens como expirados em massa** | `REVOKE ... FROM PUBLIC`; `GRANT ... TO service_role` |
| `get_linked_rooms(uuid)` | PUBLIC/anon | apenas `service_role` | EXECUTE (PUBLIC) | Enumeração da topologia de salas | idem |
| `enforce_task_creator_fields()` | PUBLIC | apenas `service_role` | EXECUTE (PUBLIC) | Função de trigger exposta | `REVOKE ... FROM PUBLIC` |
| `update_updated_at_column()` | PUBLIC | apenas `service_role` | EXECUTE (PUBLIC) | Função de trigger exposta | `REVOKE ... FROM PUBLIC` |
| `is_internal_user`, `is_admin`, `is_admin_or_analista`, `has_role`, `has_permission` | anon | `authenticated` + `service_role` | EXECUTE (PUBLIC) | Oráculo anônimo de papéis: confirma se um UUID é admin | `REVOKE FROM PUBLIC` + `GRANT TO authenticated, service_role` |
| `find_available_rooms` (2 assinaturas) | anon | `authenticated` + `service_role` | EXECUTE (PUBLIC) | Consulta anônima de disponibilidade | idem |
| `check_reservation_conflict` (2 assinaturas) | anon | `authenticated` + `service_role` | EXECUTE (PUBLIC) | idem | idem |
| 7 RPCs públicas (`create_public_classroom_call`, `get_public_classroom_call_status`, `create_public_uber_request`, `get_public_reservations`, `ps_public_event_roster`, `ps_public_sign_attendance`, `ps_public_submit_evaluation`) | anon | EXECUTE | EXECUTE | — | **manter** (concedido explicitamente após o `REVOKE FROM PUBLIC`) |

Todas as `SECURITY DEFINER` do destino já estão com `owner = postgres` e `search_path = public`; o script reforça isso de forma idempotente.

### 3.3 Schema, sequences e storage

| Item | Situação | Ação |
|---|---|---|
| `USAGE ON SCHEMA public` | presente para anon/authenticated/service_role | reforço idempotente |
| `CREATE ON SCHEMA public` | não concedido | `REVOKE` defensivo |
| Sequences | única sequence é `_grants_backup_virada_id_seq` (artefato); todas as PKs de negócio são `uuid`/`gen_random_uuid()` | **nenhum GRANT de sequence**; revoke no artefato |
| Storage `lost-items` / `task-attachments` | buckets privados, policies do script 13 aplicadas, listagem autenticada retorna 200 | **nenhuma alteração** |

---

## 4. Módulos potencialmente bloqueados hoje

| Módulo | INSERT | UPDATE | DELETE | RPC | Storage |
|---|---|---|---|---|---|
| Demandas (tasks/comentários/histórico/equipe) | OK | OK | OK | — | OK |
| Achados e Perdidos | OK | OK | OK | `expire_old_lost_items` exposta a anon | OK (URLs assinadas) |
| Empréstimos / Equipamentos / Inventário | OK | OK | OK | — | — |
| Armários | OK | OK | OK | — | — |
| Chamados de Sala | OK (interno) / OK (público via RPC) | OK | OK | OK | — |
| Reservas de Sala | OK | OK | OK | **PGRST203** se o cliente omitir `p_is_external` em `find_available_rooms` / `check_reservation_conflict` | — |
| Checklists (diário/semestral/handover) | OK | OK | OK | — | — |
| Uber Corporativo | OK | OK | OK | OK | — |
| Processo Seletivo | OK | OK | OK | OK | — |
| Administração / Logs / Permissões | OK | OK | OK | OK | — |

Tabelas com `RLS_BLOCK` para o papel `assistente` (`equipment`, `rooms`, `lockers`, `room_checklists`, `shift_handovers`, `material_requests`, `lost_items_archive`) reproduzem o comportamento da origem — são restritas a admin/supervisor por policy, **não** por falta de GRANT.

**Conclusão sobre as falhas de escrita relatadas:** não têm origem em GRANTs. As causas prováveis restantes, a confirmar com um caso concreto (tabela + payload + mensagem de erro), são: (i) sessão autenticada contra o projeto antigo (somente-leitura) ainda em cache no navegador; (ii) chamada de RPC sobrecarregada sem `p_is_external`; (iii) policy que exige papel que o usuário não possui no destino.

---

## 4.1 Matriz completa: snapshot da origem × destino

A matriz CSV anexa cobre as **58 tabelas** e os papéis `anon` e `authenticated` (116 linhas): `matriz-permissoes-origem-destino.csv`.

Critério usado:

- **Origem:** `_grants_backup_virada`, capturado antes do modo somente leitura. Ele contém INSERT/UPDATE/DELETE; SELECT foi preservado fora do snapshot.
- **Destino/anon:** sondagem REST não destrutiva por tabela: `SELECT limit=0`, INSERT com UUID propositalmente inválido e UPDATE/DELETE sobre UUID inexistente. Resultado: nenhuma resposta `permission denied for table`; os 58 INSERTs chegaram à validação de tipo (`22P02`) e os 58 UPDATE/DELETE chegaram ao executor (`204`). Isso comprova que os GRANTs existem, sem gravar ou alterar linhas.
- **Destino/authenticated:** a repetição independente com usuário interno comum ficou **bloqueada nesta execução**, pois não há uma sessão/JWT de usuário do projeto externo disponível no ambiente (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`). O relatório anterior testou um usuário temporário `assistente`, removido depois. Portanto a matriz marca essa parte como “não reexecutada”, sem apresentar inferência como novo teste.

Resumo objetivo do snapshot:

| Papel | Tabelas com I/U/D na origem | Ausências |
|---|---:|---|
| `authenticated` | 58/58 | nenhuma |
| `anon` | 54/58 | `classroom_calls`, `ps_evaluations`, `ps_event_collaborators`, `uber_requests` |

O snapshot confirma expressamente INSERT/UPDATE/DELETE de `anon` em `ps_events`, `ps_roles` e `room_combinations`. A versão anterior do relatório interpretou incorretamente essas três tabelas como excessos; o rascunho do script 14 foi corrigido para **não revogar** seus privilégios.

### Testes funcionais solicitados

| Cenário | Escritas envolvidas | Resultado atual |
|---|---|---|
| INSERT | tabela específica do fluxo | GRANT de `anon` confirmado nas 58 tabelas; `authenticated` já havia passado na sondagem anterior, mas não foi repetido sem JWT comum |
| UPDATE | tabela específica do fluxo | idem; UPDATE não destrutivo retornou 204 para `anon` nas 58 tabelas |
| DELETE | tabela específica do fluxo | idem; DELETE não destrutivo retornou 204 para `anon` nas 58 tabelas |
| Baixa de item | UPDATE em `lost_items` + INSERT em `activity_logs` | caminho frontend confirmado; autorização funcional como usuário comum não reexecutada sem sessão |
| Criação de chamado | público: RPC `create_public_classroom_call`; interno: INSERT em `classroom_calls` | RPC pública é o caminho correto; o acesso direto anônimo deve ser removido pelo script 14 |
| Envio de formulário | varia por formulário; chamados/Uber/avaliação PS usam RPCs públicas | superfície mapeada; teste autenticado real pendente pelo mesmo bloqueio de sessão |

**Conclusão estrita:** não há evidência de GRANT ausente. A hipótese compatível com falhas de escrita permanece **RLS/identidade** (papel ausente, `auth.uid()` diferente do esperado ou sessão apontando para a origem antiga), não GRANT. Para atribuir uma falha concreta a uma policy específica, é necessário capturar a requisição real com usuário interno comum autenticado no frontend externo.

---

## 5. Objetos afetados pelo script 14

| Categoria | Quantidade |
|---|---|
| Tabelas com REVOKE para `anon` | 5 (4 de negócio + 1 artefato) |
| Tabelas com GRANT explícito para `service_role` | 18 |
| Tabelas de negócio inalteradas | 54 |
| Funções com `REVOKE ... FROM PUBLIC` | 21 (todas) |
| Funções com GRANT para `authenticated` | 9 |
| Funções com GRANT para `anon` (rotas públicas) | 7 |
| Funções com GRANT apenas para `service_role` | 2 |
| Sequences alteradas | 1 (artefato de migração) |
| Objetos de Storage alterados | 0 |

---

## 6. Riscos da aplicação

1. **Baixo risco de quebra funcional:** o script majoritariamente remove privilégios que a origem não concedia. As rotas públicas mantêm `EXECUTE` explícito.
2. **Risco pontual:** o `REVOKE ALL ON FUNCTION ... FROM PUBLIC` em bloco atinge todas as funções; qualquer função nova que dependa do default `PUBLIC` deixaria de ser chamável. Mitigação: os `GRANT` das seções 5.2–5.5 cobrem todas as 21 funções existentes.
3. **`ALTER FUNCTION ... OWNER TO postgres`** só é executado se o owner for diferente — hoje já é `postgres`, portanto no-op.
4. Script transacional (`BEGIN/COMMIT`): falha em qualquer ponto reverte tudo.
5. Não toca em Storage, cron, Edge Functions, dados nem policies RLS.

---

## 7. Testes obrigatórios após a aplicação

**Rotas públicas (sem login, em aba anônima)**
1. `/chamado-sala`: abrir, selecionar campus → sala → problema, enviar; a tela de espera deve exibir o status.
2. `/painel-reservas`: grade 7h–21h carrega via `get_public_reservations`.
3. `/portal-cliente`: cadastro externo.
4. Uber público: envio de solicitação.
5. Assinatura de presença e avaliação de fiscal (PS).

**Negativos (devem falhar)**
6. `GET /rest/v1/classroom_calls` com a chave publicável → esperado erro de permissão.
7. `POST /rest/v1/rpc/expire_old_lost_items` com a chave publicável → esperado `permission denied for function`.
8. `POST /rest/v1/rpc/is_admin` com a chave publicável → esperado `permission denied for function`.

**Interno (login por papel: admin, supervisor, analista, assistente, atendente, visualizador)**
9. Demandas: criar, editar, comentar, anexar arquivo, concluir.
10. Achados e Perdidos: cadastrar com foto, visualizar imagem (URL assinada), entregar com assinatura, excluir (admin).
11. Empréstimos: criar, alterar data prevista, devolver; pré-reserva.
12. Armários: empréstimo, troca, devolução.
13. Reservas: buscar salas disponíveis, criar, reagendar, cancelar, importar planilha.
14. Checklists diário e semestral: preencher, exportar período, limpar período.
15. Processo Seletivo: importar planilha, gerar etiquetas e PDF de presença.
16. Administrativo: usuários, papéis, permissões, logs de atividade.
17. Edge Functions: envio de e-mail de demanda, geração de PDF, cron de expiração (com `service_role`).

---

## 8. Aguardando autorização

O arquivo `migracao/14-corrigir-permissoes-pos-migracao.sql` está pronto e **não foi executado**.

---

## 9. Reconciliação com a auditoria estática do kit de migração

Três auditorias paralelas (frontend, `01_estrutura.sql`, kit `migracao/`) concluíram, por análise estática, que a ausência de `GRANT ... ON public.<tabela>` no dump deixaria o app "logado porém sem escrita". **Essa hipótese foi testada e refutada no destino:**

- O gerador (`gen-estrutura.py:238-249`) consultou `information_schema.role_table_grants`, que filtra por visibilidade do papel executor — por isso a seção de GRANTs saiu vazia. É artefato de extração, não ausência real na origem (confirmado por `pg_class.relacl`).
- No destino, os *default privileges* do Supabase aplicaram os GRANTs no `CREATE TABLE` executado como `postgres`. Sondagem com chave publicável e com JWT de usuário interno retornou **sempre** `42501 row-level security` ou erro de constraint — nunca `permission denied for table`.
- Os testes de prontidão anteriores de fato usaram `service_role` (mascarariam o problema), mas a auditoria atual usou `anon` e `authenticated` reais.

**Conclusão:** o script 14 não precisa restaurar GRANTs de tabela. Ele apenas remove excesso e corrige `EXECUTE`.

### Achados complementares (fora do escopo de permissões, para acompanhamento)

| # | Achado | Situação no destino | Recomendação |
|---|---|---|---|
| 1 | `useCreateClassroomCall` faz INSERT direto em `classroom_calls` como fallback do RPC | INSERT anônimo é **barrado pela RLS** (não existe policy `WITH CHECK (true)`) | manter; o fallback só funciona para usuário interno |
| 2 | Edge Function `create-classroom-call` órfã (tem rate-limit e sanitização que o RPC não tem) | não invocada pelo frontend | portar rate-limit para o RPC ou remover a function |
| 3 | Leitura pública de reservas duplicada: policy `anon SELECT` + RPC `get_public_reservations` | ambas ativas | consolidar no RPC |
| 4 | `activity_logs` / `task_history` inseridos pelo cliente | funcional | migrar para trigger/`SECURITY DEFINER` para rastreabilidade confiável |
| 5 | `BulkImageUploadDialog` usa `upsert: true` | funcional | garantir path com UUID único |
| 6 | Módulo PS: 11 tabelas com `FOR ALL USING (is_internal_user())` | igual à origem | segregar por sub-papel se desejado |
| 7 | Inserts públicos (`ps_fiscal_bank_applications`, `PortalSignup`) sem captcha/rate-limit | igual à origem | avaliar proteção anti-flood |
| 8 | Cron do destino criado com `active = false` | inativo | ativar via `05b-ativar-cron-na-virada.sql` após a virada de domínio |
