import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902410000_ps_retire_legacy_public_evaluation.sql',
    import.meta.url
  ),
  'utf8'
);

const page = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicEvaluation.tsx',
    import.meta.url
  ),
  'utf8'
);

test('RPC legado de avaliação não pode mais ser executado pelo público', () => {
  assert.match(
    sql,
    /REVOKE ALL[\s\S]*ps_public_submit_evaluation[\s\S]*FROM PUBLIC,\s*anon,\s*authenticated/i
  );

  assert.match(
    sql,
    /GRANT EXECUTE[\s\S]*TO service_role/i
  );
});

test('links antigos são enviados ao portal autenticado do avaliador', () => {
  assert.match(page, /Navigate/);
  assert.match(page, /\/ps\/avaliador/);
  assert.doesNotMatch(page, /ps_public_submit_evaluation/);
});
