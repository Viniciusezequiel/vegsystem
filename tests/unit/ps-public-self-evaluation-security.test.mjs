import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const securitySql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902440000_ps_secure_public_self_evaluation.sql',
    import.meta.url
  ),
  'utf8'
);

const postEventSql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20261019174800_ps_allow_finalized_self_evaluation.sql',
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

test('autoavaliação pública exige evento explicitamente habilitado e visível', () => {
  assert.match(
    postEventSql,
    /self_evaluation_enabled[\s\S]*=\s*true/i
  );

  assert.match(
    postEventSql,
    /hidden_from_evaluation[\s\S]*false/i
  );
});

test('evento finalizado pode receber autoavaliação sem reabrir presença', () => {
  const selfEvaluationBranch = postEventSql.match(
    /p_surface\s*=\s*'self_evaluation'[\s\S]*?\n\s*\)\n\s*\)/i
  )?.[0] || '';

  assert.doesNotMatch(
    selfEvaluationBranch,
    /status\s*<>\s*'finalizado'/i
  );

  assert.match(
    postEventSql,
    /p_surface\s*=\s*'attendance'[\s\S]*status\s*<>\s*'finalizado'/i
  );
});

test('anon não insere diretamente na tabela de autoavaliações', () => {
  assert.match(
    securitySql,
    /REVOKE INSERT[\s\S]*ps_self_evaluations[\s\S]*FROM anon/i
  );

  assert.match(
    postEventSql,
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
