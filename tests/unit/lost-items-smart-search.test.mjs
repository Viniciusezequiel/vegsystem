import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902500000_lost_items_smart_search.sql',
    import.meta.url
  ),
  'utf8'
);

const helper = fs.readFileSync(
  new URL(
    '../../src/lib/lostItemSmartSearch.ts',
    import.meta.url
  ),
  'utf8'
);

const hook = fs.readFileSync(
  new URL(
    '../../src/hooks/useInfiniteLostItems.ts',
    import.meta.url
  ),
  'utf8'
);

const page = fs.readFileSync(
  new URL(
    '../../src/pages/ItemsList.tsx',
    import.meta.url
  ),
  'utf8'
);

test('busca inteligente usa unaccent e trigram', () => {
  assert.match(migration, /unaccent/i);
  assert.match(migration, /word_similarity/i);
  assert.match(migration, /similarity/i);
});

test('busca aceita palavras em qualquer posição', () => {
  assert.match(migration, /token_groups/);
  assert.match(migration, /NOT EXISTS/);
});

test('busca possui sinônimos básicos', () => {
  assert.match(
    migration,
    /caneca.*copo.*xicara.*mug/s
  );

  assert.match(
    migration,
    /celular.*telefone.*smartphone/s
  );
});

test('RPC respeita permissões do usuário', () => {
  assert.match(migration, /SECURITY INVOKER/);

  assert.match(
    migration,
    /FROM PUBLIC,\s*anon/
  );

  assert.match(
    migration,
    /TO authenticated,\s*service_role/
  );
});

test('listagem usa a nova busca', () => {
  assert.match(hook, /smartSearchLostItems/);
  assert.match(
    hook,
    /matchesSmartLostItemOffline/
  );
});

test('offline também aceita busca aproximada', () => {
  assert.match(helper, /editDistance/);
  assert.match(helper, /fuzzyWordMatch/);
});

test('interface identifica a busca inteligente', () => {
  assert.match(page, /Busca inteligente:/);
  assert.match(page, /smartSearchLostItems/);
});
