# Deploy na Vercel + virada final para o Supabase `sshyjnyvihdheofjzsca`

Arquitetura final: **Lovable** (edição) → **GitHub** (repositório) → **Vercel** (hospedagem do frontend) → **Supabase `sshyjnyvihdheofjzsca`** (banco, Auth, Storage, Edge Functions).

O backend antigo (Lovable Cloud) permanece intacto durante todo o processo.

---

## 1. Configuração da Vercel

| Campo | Valor |
| --- | --- |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 20.x ou 22.x |

Esses valores já estão fixados em `vercel.json`, então basta importar o repositório.

### Variáveis de ambiente (Production, Preview e Development)

```
VITE_SUPABASE_URL            = https://sshyjnyvihdheofjzsca.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = <anon/publishable key do projeto de destino>
VITE_SUPABASE_PROJECT_ID     = sshyjnyvihdheofjzsca
```

São as únicas três variáveis do frontend. Nenhuma outra é lida pelo build.
**Nunca** cadastrar `service_role`, senha do banco ou secrets administrativos na Vercel — eles vivem só nos secrets do Supabase, usados pelas Edge Functions.

### Rewrites e headers

`vercel.json` já define:

- **Rewrite SPA**: qualquer rota sem extensão de arquivo cai em `/index.html`. Isso resolve acesso direto e refresh em `/admin-auth`, `/change-password`, `/reservas`, `/portal-cliente/...`, `/ps/...` etc.
- **Cache**: `assets/*` imutável por 1 ano; `index.html`, `sw.js` e `manifest.webmanifest` sem cache, para o PWA atualizar na virada.
- **Headers de segurança**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.

---

## 2. Supabase de destino — Auth e URLs

Em **Authentication → URL Configuration** do projeto `sshyjnyvihdheofjzsca`:

**Site URL** (fase de teste): `https://<projeto>.vercel.app`
**Site URL** (após a virada): `https://vegsystem.site`

**Redirect URLs** (cadastrar todas, para teste e produção conviverem):

```
https://<projeto>.vercel.app/**
https://vegsystem.site/**
https://www.vegsystem.site/**
http://localhost:8080/**
```

O app usa `window.location.origin` para montar todos os links de redirect, então nenhum domínio está hardcoded:

- recuperação de senha → `${origin}/change-password` (`src/pages/AdminAuth.tsx`)
- confirmação de cadastro do portal → `${origin}/portal-cliente/login` (`src/pages/portal-cliente/PortalSignup.tsx`)
- links públicos (`/chamado-sala`, `/painel-reservas`, `/solicitar-uber`, `/ps/...`) seguem o domínio de onde foram gerados.

### Secrets das Edge Functions no destino

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo Supabase. Faltam cadastrar manualmente:

```
RESEND_API_KEY               (e-mails de atribuição de demanda)
RECURRING_TASKS_CRON_SECRET  (proteção do cron de demandas recorrentes)
```

Todas as 12 Edge Functions usam apenas `Deno.env.get(...)` — nenhuma referência de projeto está hardcoded, então são portáveis sem alteração de código. As funções `*-migracao` são temporárias e **não** devem ser publicadas no destino.

### `verify_jwt`

Reproduzir no destino o que está em `supabase/config.toml`: `setup-first-admin`, `create-classroom-call`, `update-user-email`, `get-classroom-call-config` e `notify-task-assignment` com `verify_jwt = false` (a validação é feita dentro do código).

---

## 3. Checklist de teste na URL temporária da Vercel

Rodar tudo **antes** de mexer no domínio. Nesta fase o destino já contém a cópia dos dados, então os registros de teste criados aqui precisam ser removidos depois.

- [ ] App carrega sem tela preta e sem erro de configuração
- [ ] Login em `/admin-auth`
- [ ] Logout e nova sessão
- [ ] "Esqueci minha senha" → e-mail chega → link abre `/change-password` no domínio da Vercel
- [ ] `/change-password` altera a senha e limpa `force_password_change`
- [ ] Refresh direto em `/reservas`, `/demandas`, `/achados`, `/portal-cliente/login` (sem 404)
- [ ] Leitura: listas de demandas, equipamentos, reservas, achados e perdidos
- [ ] Escrita: criar, editar e excluir um registro de teste em cada módulo crítico
- [ ] RLS: usuário `visualizador` não consegue gravar; `atendente` só vê chamados de sala
- [ ] Storage: upload de foto em achados e perdidos e exibição via URL assinada
- [ ] Storage: anexo em comentário de demanda
- [ ] RPCs públicas: `/chamado-sala`, `/solicitar-uber`, `/painel-reservas`, `/ps/banco-fiscais`
- [ ] Edge Functions: criação de usuário, reset de senha, geração de PDF
- [ ] Resend: e-mail de atribuição de demanda chega
- [ ] Realtime: chamado de sala aparece em outra aba sem refresh
- [ ] PWA instala e abre offline com dados em cache
- [ ] Remover todos os registros de teste

---

## 4. Plano exato da virada final

1. Publicar a app na Vercel e concluir o checklist da seção 3 na URL temporária.
2. Avisar os usuários e **entrar em janela de manutenção**: executar as seções 1 e 2 de `migracao/11-janela-manutencao-origem.sql` na ORIGEM. A partir daí, a app antiga fica somente leitura e nenhuma gravação nova entra no banco antigo.
3. Executar o **último delta** (`migracao/08-sincronizacao-final.sh`) com `CORTE` igual ao horário exato da entrada em read-only.
4. Executar a **validação** (`migracao/09-validacao-pos-sincronizacao.sh`). Só seguir com 58/58 tabelas iguais, 0 IDs ausentes, 0 divergências, Auth e Storage equivalentes e 0 FKs órfãs.
5. Apontar `vegsystem.site` (e `www`) para a Vercel: adicionar o domínio no projeto da Vercel e atualizar os registros DNS conforme instruído lá.
6. Trocar a **Site URL** do Supabase de destino para `https://vegsystem.site`.
7. Confirmar que a produção nova responde no domínio e refazer os testes essenciais (login, leitura, uma gravação real).
8. **Cron**: desativar os três jobs na ORIGEM, confirmar que pararam, e só então executar `migracao/05b-ativar-cron-na-virada.sql` no destino. Nunca ativos nos dois ambientes ao mesmo tempo.
9. Manter o backend antigo em read-only por pelo menos alguns dias, sem excluir nada.

---

## 5. Plano de rollback

Gatilho: qualquer falha crítica de login, leitura, gravação, RLS ou Storage na produção nova.

1. Desativar imediatamente os três cron jobs no destino (`cron.alter_job(jobid, active := false)`).
2. Reverter o DNS de `vegsystem.site` para o alvo anterior (a app da Lovable).
3. Executar a seção 3 de `migracao/11-janela-manutencao-origem.sql` para tirar a origem do read-only.
4. Reativar os três cron jobs na origem.
5. Confirmar login e gravação no backend antigo.
6. Levantar o que foi gravado no destino durante a tentativa, para reconciliação:

```sql
select 'tabela', count(*) from public.<tabela> where created_at >= '<inicio-da-virada>';
```

Nada é excluído no destino — ele continua servindo como réplica até a próxima tentativa.
