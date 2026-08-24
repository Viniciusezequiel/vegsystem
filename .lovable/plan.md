# Migração por dentro do Cloud (sem credenciais de origem)

A senha do banco e a service role key do Lovable Cloud não são acessíveis. Então, em vez de `pg_dump` a partir da sua máquina, a cópia é feita **de dentro do próprio backend atual**, que já tem acesso privilegiado a si mesmo e pode escrever direto no seu projeto novo (`sshyjnyvihdheofjzsca`) usando a service key **do destino**.

## Como vai funcionar

```text
Lovable Cloud (origem)                      Seu Supabase (destino)
  função "export-migracao"  --HTTPS-->  REST + Storage do destino
  (roda com service role da origem)      (autentica com DST service key)
```

Nada sai para fora dos dois projetos. A service key do destino fica guardada como segredo do backend, nunca no código.

## Etapas

1. **Estrutura**: eu gero um único arquivo `migracao/dump/01_estrutura.sql` com todas as 59 tabelas, os 8 enums, as 20 funções, os 32 triggers, RLS, políticas e GRANTs — reconstruído a partir do histórico de migrações e do estado atual do banco. Você aplica no destino pelo SQL Editor.
2. **Segredo do destino**: você cadastra `DST_SERVICE_KEY` (service role do projeto novo) nos segredos do backend. Só isso é pedido de você.
3. **Função de cópia de dados** (`export-migracao`, temporária, restrita a admin): lê cada tabela da origem em páginas de 500 linhas e insere no destino via REST com `upsert`, na ordem de dependência (perfis e papéis primeiro, depois o resto). Retorna contagem por tabela.
4. **Função de cópia de arquivos** (`export-storage-migracao`, temporária): percorre os buckets `lost-items` e `task-attachments`, baixa cada arquivo na origem e envia ao destino mantendo o mesmo caminho. Os buckets precisam existir no destino como privados.
5. **Usuários**: `auth.users` não é copiável por REST. Eu gero um script que recria cada usuário no destino via Admin API **com o mesmo UUID** (obrigatório, porque `profiles.user_id`, `user_roles`, `tasks` e `activity_logs` apontam para ele). As senhas não migram — os usuários recebem e-mail de redefinição no primeiro acesso.
6. **Funções e agendamentos**: publicar as 12 edge functions no destino (`04-deploy-functions.sh` já pronto), cadastrar `RESEND_API_KEY` e `RECURRING_TASKS_CRON_SECRET`, e rodar `05-cron.sql`.
7. **Conferência**: uma tela/rota temporária de verificação compara a contagem de linhas tabela a tabela entre origem e destino.
8. **Virada**: conectar o projeto novo em Connectors → Supabase, rodar o checklist de testes do `README.md`, remover as funções temporárias e só então desligar o Cloud.

## Ponto de atenção

O único item que não sobrevive intacto é a **senha dos usuários**. Se isso for bloqueante, a alternativa é abrir um chamado com o suporte do Lovable pedindo a credencial de banco da origem — é o único caminho que preserva os hashes de senha.

## Detalhes técnicos

- As funções temporárias exigem JWT válido e checagem `is_admin(auth.uid())`; nenhuma aceita chamada anônima.
- Inserção com `Prefer: resolution=merge-duplicates` e RLS ignorada (service role do destino), preservando UUIDs originais.
- Ordem de carga: `profiles`, `user_roles`, `role_permissions` → tabelas de catálogo (`rooms`, `reservation_rooms`, `equipment`, `lockers`, `ps_*` base) → tabelas transacionais → `activity_logs`.
- Colunas grandes (`image_url` em base64 em registros antigos, assinaturas em `ps_event_collaborators`) são copiadas em páginas menores (100 linhas) para não estourar memória.
- Após a carga, resetar as sequências e revalidar `GRANT EXECUTE ... TO anon` nas funções públicas (`create_public_classroom_call`, `create_public_uber_request`, `get_public_reservations`, `ps_public_*`), conforme já listado em `07-checklist-virada.md`.
- Os scripts antigos que dependiam de `SRC_DB_URL` (`01-export.sh`, `02-import.sh`, `03-storage-copy.mjs`, `06-verify.mjs`) ficam marcados como alternativos no README.
