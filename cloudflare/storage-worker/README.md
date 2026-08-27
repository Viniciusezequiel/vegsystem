# VEG System R2 Storage Worker

Worker isolado para objetos cujo locator no banco começa com `r2/`. Ele não
acessa nem serve objetos do Supabase Storage.

## Rotas

- `POST /v1/files/resolve`: resolve até 50 locators R2 para URLs temporárias.
- `GET|HEAD /v1/objects/:scope/*`: leitura mediante capability curta.
- `POST /v1/files/:scope`: upload autenticado, com key gerada no servidor.
- `DELETE /v1/files/:scope/*`: exclusão autenticada, exata e condicionada à
  ausência de referências no banco.

O primeiro rollout habilita somente `lost-items`. O código reconhece o scope
`task-attachments`, mas suas rotas retornam `404` sem `ENABLE_TASK_ATTACHMENTS=true`
e sem o binding `TASK_ATTACHMENTS_BUCKET`. A exclusão consulta as duas tabelas de
Achados e Perdidos e qualquer falha de consulta preserva o objeto.

## Segredos e bindings

Nunca versione valores reais. Configure no Cloudflare:

- secret `CAPABILITY_SIGNING_SECRET` (aleatório, no mínimo 32 bytes);
- binding R2 `LOST_ITEMS_BUCKET` no primeiro rollout.

`SUPABASE_PUBLISHABLE_KEY` é uma variável pública necessária porque o gateway
PostgREST exige o header `apikey`, mesmo quando a chamada já leva o JWT do usuário.
Ela não concede privilégios administrativos. No primeiro rollout, configure
apenas `LOST_ITEMS_BUCKET`.

Copie `wrangler.example.jsonc` para uma configuração local ignorada ou configure
o Worker pelo dashboard. Não faça deploy antes da aprovação operacional.

## Desenvolvimento

```sh
npm test
npm run check
```
