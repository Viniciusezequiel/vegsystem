# Auditoria e correção de permissões pós-migração

## Objetivo
Reproduzir no backend externo o modelo de acesso do sistema antigo sem desativar RLS, sem abrir tabelas indiscriminadamente e sem alterar a origem em somente leitura.

## Diagnóstico preliminar confirmado
- O dump preservou as 183 policies RLS e as funções auxiliares, mas a seção de GRANTs não contém GRANTs de tabelas; isso explica leituras permitidas em alguns caminhos e falhas generalizadas de escrita no destino.
- Os 28 perfis internos migrados mantêm vínculo em `profiles` e `user_roles`; há 4 contas Auth sem perfil/role, compatíveis com contas antigas/inativas e que serão apenas reportadas, não promovidas automaticamente.
- As RPCs públicas principais existem e respondem no destino. `/chamado-sala` carrega salas/problemas anonimamente e a RPC de criação está publicada; a correção garantirá explicitamente `EXECUTE` para `anon` sem conceder leitura ou escrita direta em `classroom_calls`.
- As 12 Edge Functions esperadas estão publicadas. Os testes anônimos mostram que as funções administrativas rejeitam acesso, enquanto as funções públicas respondem.
- As policies de Storage para os buckets privados existem; falta conferir e corrigir os privilégios de objeto necessários às operações autenticadas.

## Implementação
1. **Inventário completo**
   - Consolidar todas as escritas diretas do frontend, RPCs, Edge Functions e operações de Storage por módulo.
   - Cruzar cada operação com a policy original exportada e com o comportamento esperado por perfil.

2. **Script único e idempotente**
   - Criar `migracao/14-corrigir-permissoes-pos-migracao.sql`.
   - Conceder somente os privilégios de tabela exigidos pelas policies e pelas operações efetivamente usadas pelo frontend.
   - Conceder acesso autenticado às tabelas internas por operação, mantendo a decisão final nas policies RLS.
   - Conceder acesso anônimo direto somente aos catálogos públicos de leitura e aos formulários públicos que já possuem policies anônimas específicas.
   - Para `/chamado-sala`, manter `classroom_calls` sem leitura/alteração pública direta e permitir criação somente por `create_public_classroom_call(...)` com `SECURITY DEFINER`, validação e `search_path` fixo.
   - Revogar execução implícita de RPCs sensíveis de `PUBLIC` e reaplicar `EXECUTE` explicitamente a `anon`, `authenticated` e/ou `service_role`, conforme o uso real.
   - Corrigir privilégios de sequences somente quando necessários e preservar funções de trigger como não executáveis pelo cliente.
   - Garantir privilégios de `service_role` de forma explícita nas tabelas/funções usadas pelas Edge Functions, sem ampliar anon.
   - Reaplicar as policies idempotentes de `storage.objects` para `lost-items` e `task-attachments`, mantendo ambos privados.
   - Incluir consultas finais de diagnóstico no próprio script para conferir grants, policies, roles órfãs e funções executáveis.

3. **Relatório de auditoria**
   - Criar `migracao/RELATORIO-AUDITORIA-PERMISSOES-POS-MIGRACAO.md` com a matriz solicitada:
     - tabela/função;
     - operação;
     - permissão antiga;
     - permissão atual observada/inferida;
     - problema;
     - correção proposta.
   - Listar módulos afetados e separar bloqueios por GRANT, RLS, role, RPC, Edge Function e Storage.

4. **Revisão antes da aplicação**
   - Apresentar o conteúdo do SQL e o relatório sem executar nada no destino.
   - A aplicação no backend externo ficará condicionada à sua aprovação explícita e deverá ser feita na conexão do destino, nunca no backend antigo.

5. **Validação após aprovação/aplicação**
   - Executar testes controlados com usuário autenticado e limpeza dos registros de teste para INSERT, UPDATE e DELETE nos fluxos representativos de cada módulo.
   - Testar RPCs autenticadas e públicas.
   - Testar `/chamado-sala` em sessão anônima: carregar configuração, criar chamado via RPC, consultar somente o status pelo UUID e confirmar que listagem/UPDATE/DELETE públicos continuam bloqueados.
   - Testar upload, leitura assinada e remoção autorizada nos buckets privados.
   - Testar Edge Functions públicas e protegidas, confirmando 401/403 nos acessos indevidos.
   - Rodar o linter e a auditoria de segurança; corrigir apenas regressões relacionadas a esta mudança.
   - Rodar `npm run build` somente se a auditoria exigir ajuste de frontend.

## Limites de segurança
- Não desativar RLS.
- Não conceder acesso anônimo global nem UPDATE/DELETE público.
- Não atribuir roles automaticamente às 4 contas sem vínculo.
- Não remover policies existentes sem substituição equivalente e justificativa no relatório.
- Não executar qualquer comando de escrita na origem.
- Não alterar dados de negócio; testes usarão registros identificáveis e serão removidos.
