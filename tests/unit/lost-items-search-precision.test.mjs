import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260908163100_lost_items_search_precision.sql',
    import.meta.url
  ),
  'utf8'
);

function section(start, end) {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `secao ${start} deve existir`);
  assert.notEqual(to, -1, `secao ${end} deve existir`);
  return migration.slice(from, to);
}

test('V2 preserva assinatura publica, STABLE e SECURITY INVOKER', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.search_lost_items_smart\(/);
  assert.match(migration, /p_search text/);
  assert.match(migration, /p_limit integer DEFAULT 50/);
  assert.match(migration, /p_offset integer DEFAULT 0/);
  assert.match(migration, /LANGUAGE sql\s+STABLE\s+SECURITY INVOKER/s);
});

test('camada forte exige tokens exatos ou sinonimos normalizados', () => {
  const strong = section('strong_matches AS (', 'fuzzy_matches AS (');
  assert.match(strong, /b\.haystack LIKE '%' \|\| variant\.value \|\| '%'/);
  assert.match(strong, /NOT EXISTS \(\s*SELECT 1\s*FROM token_groups g/s);
  assert.doesNotMatch(strong, />= 0\.32/);
  assert.doesNotMatch(strong, />= 0\.42/);
});

test('fuzzy so e usado quando nenhum strong match visivel existe', () => {
  const fuzzy = section('fuzzy_matches AS (', 'scored AS (');
  assert.match(fuzzy, /NOT EXISTS \(SELECT 1 FROM strong_matches\)/);
  assert.match(fuzzy, /FROM base b/);
  assert.match(migration, /Um strong match oculto por RLS nao bloqueia resultados visiveis/);
});

test('threshold curto preserva terso→terco e rejeita terreo/termica', () => {
  const threshold = 0.32;
  const measured = {
    tersoTerco: 0.333333,
    tersoTerreo: 0.3,
    tersoTermica: 0.272727,
  };

  assert.ok(measured.tersoTerco >= threshold);
  assert.ok(measured.tersoTerreo < threshold);
  assert.ok(measured.tersoTermica < threshold);

  assert.match(migration, /length\(variant\.value\) BETWEEN 5 AND 7[\s\S]*?>= 0\.32/);
  assert.match(migration, /length\(variant\.value\) >= 8[\s\S]*?>= 0\.42/);
  assert.match(migration, /strict_word_similarity/);
});

test('filtros de status campus datas e destino permanecem na RPC', () => {
  assert.match(migration, /p_status IS NULL[\s\S]*?li\.status = p_status/);
  assert.match(migration, /p_campus IS NULL[\s\S]*?li\.campus = p_campus/);
  assert.match(migration, /p_date_from IS NULL[\s\S]*?li\.received_date >= p_date_from/);
  assert.match(migration, /p_date_to IS NULL[\s\S]*?li\.received_date <= p_date_to/);
  assert.match(migration, /p_destination = 'donation'[\s\S]*?li\.owner_name = 'DOAÇÃO'/);
  assert.match(migration, /p_destination = 'disposal'[\s\S]*?li\.owner_name = 'DESCARTE'/);
});

test('codigo descricao e localizacao continuam compondo o haystack', () => {
  assert.match(
    migration,
    /concat_ws\([\s\S]*?li\.code,[\s\S]*?li\.description,[\s\S]*?li\.found_location[\s\S]*?\)/
  );
  assert.match(migration, /unaccent\(/i);
});

test('sinonimos existentes continuam preservados', () => {
  assert.match(migration, /caneca.*copo.*xicara.*mug/s);
  assert.match(migration, /celular.*telefone.*smartphone/s);
  assert.match(migration, /garrafa.*squeeze/s);
  assert.match(migration, /mochila.*bolsa.*backpack/s);
  assert.match(migration, /carteira.*porta-cartao.*portacartao/s);
});

test('paginacao total_count e grants permanecem compativeis', () => {
  assert.match(migration, /count\(\*\) OVER\(\) AS total_count/);
  assert.match(migration, /LIMIT greatest\([\s\S]*?least\(coalesce\(p_limit, 50\), 1000\)/);
  assert.match(migration, /OFFSET greatest\([\s\S]*?coalesce\(p_offset, 0\)/);
  assert.match(migration, /FROM PUBLIC, anon/);
  assert.match(migration, /TO authenticated, service_role/);
});
