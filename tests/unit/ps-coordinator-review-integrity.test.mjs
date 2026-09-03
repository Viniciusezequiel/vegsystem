import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902400000_ps_coordinator_review_integrity.sql',
    import.meta.url
  ),
  'utf8'
);

test('coordenação revisa somente avaliações feitas por subcoordenadores', () => {
  assert.match(
    sql,
    /evaluation_level\s*=\s*'subcoordinator'/i
  );

  assert.match(
    sql,
    /evaluation_level\s*<>\s*'subcoordinator'/i
  );

  assert.match(
    sql,
    /Somente avaliações realizadas por subcoordenadores podem ser retificadas/
  );
});

test('classificação da retificação é sempre calculada no backend', () => {
  assert.match(
    sql,
    /classification\s*=\s*v_classification/i
  );

  assert.doesNotMatch(
    sql,
    /classification\s*=\s*coalesce\s*\(\s*nullif\s*\(\s*trim\s*\(\s*p_new_data/i
  );
});
