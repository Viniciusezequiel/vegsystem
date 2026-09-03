import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902440000_ps_secure_public_self_evaluation.sql',
    import.meta.url
  ),
  'utf8'
);

const page = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicSelfEvaluation.tsx',
    import.meta.url
  ),
  'utf8'
);

test('autoavaliação pública exige evento habilitado e não finalizado', () => {
  assert.match(
    sql,
    /self_evaluation_enabled[\s\S]*=\s*true/i
  );

  assert.match(
    sql,
    /status\s*<>\s*'finalizado'/i
  );

  assert.match(
    sql,
    /hidden_from_evaluation[\s\S]*false/i
  );
});

test('anon não insere diretamente na tabela de autoavaliações', () => {
  assert.match(
    sql,
    /REVOKE INSERT[\s\S]*ps_self_evaluations[\s\S]*FROM anon/i
  );

  assert.match(
    sql,
    /ps_public_submit_self_evaluation/
  );
});

test('frontend envia autoavaliação somente pelo RPC validado', () => {
  assert.match(
    page,
    /ps_public_submit_self_evaluation/
  );

  assert.doesNotMatch(
    page,
    /\.from\(['"]ps_self_evaluations['"]\)[\s\S]*\.insert/
  );
});
