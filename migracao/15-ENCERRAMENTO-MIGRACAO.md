# Encerramento da migração — passo a passo final

Backend definitivo: `sshyjnyvihdheofjzsca` · Frontend: https://www.vegsystem.site

Tudo que podia ser feito por API já foi feito. Restam **3 comandos** que
exigem acesso SQL de owner no projeto de destino (SQL Editor do Supabase ou
`psql "$DST_DB_URL"`).

---

## Passo 1 — Corrigir permissões e RLS (obrigatório)

Execute o conteúdo de `migracao/14-corrigir-permissoes-pos-migracao.sql`.

Ele faz, em uma transação:
- recria a policy que permite a usuários internos criar solicitações de
  **Uber Corporativo** (única regressão funcional encontrada);
- revoga do `anon` os privilégios indevidos em `classroom_calls`,
  `ps_evaluations`, `ps_event_collaborators`, `uber_requests` e na tabela
  auxiliar `_grants_backup_virada`;
- revoga `EXECUTE ... FROM PUBLIC` de todas as funções e reconcede por papel,
  deixando `anon` apenas nas 7 RPCs públicas;
- garante owner `postgres` e `search_path` fixo nas funções `SECURITY DEFINER`;
- mantém os catálogos de `/chamado-sala` legíveis por `anon`.

Ao final, rode as consultas do bloco "VERIFICAÇÕES PÓS-APLICAÇÃO" no rodapé do
script.

## Passo 2 — Ativar o cron no destino

Os 3 jobs do backend antigo **já foram desativados** (`active = false`) em
2026-08-26, portanto não haverá duplicidade. No destino, execute
`migracao/05b-ativar-cron-na-virada.sql` (ele confere os segredos do Vault antes
de ativar).

Se os jobs ainda não existirem no destino, rode antes `migracao/05-cron.sql`.

## Passo 3 — Teste de fumaça (5 minutos, na aplicação real)

1. Login com um usuário interno comum → criar uma **Demanda** e concluí-la.
2. **Achados e Perdidos**: cadastrar item com foto (valida Storage assinado).
3. **Empréstimos**: registrar empréstimo e dar baixa.
4. **Uber Corporativo**: criar uma solicitação com usuário interno
   (é o item corrigido no Passo 1).
5. **/chamado-sala** em janela anônima: abrir chamado e acompanhar o status.
6. **/painel-reservas** em janela anônima: conferir a grade do dia.

## Passo 4 — Desligar o backend antigo

Somente após o Passo 3 passar 100%:
- manter o projeto legado pausado/somente leitura por pelo menos 30 dias como
  rede de segurança (crons já desligados, nenhuma escrita chega nele);
- depois desse período, encerrar o Lovable Cloud e manter aqui apenas o
  frontend/editor.

---

### Relatórios de referência
- `migracao/RELATORIO-AUDITORIA-PERMISSOES-POS-MIGRACAO.md` (esta rodada)
- `migracao/relatorios/virada-final-20260825T2330Z.md`
- `migracao/matriz-permissoes-origem-destino.csv`
