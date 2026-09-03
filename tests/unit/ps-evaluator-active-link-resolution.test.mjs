import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902390000_ps_evaluator_resolve_active_link.sql',
    import.meta.url
  ),
  'utf8'
);

test('todas as operações do avaliador resolvem vínculo operacional compatível com a sessão', () => {
  for (const fn of [
    'ps_public_evaluator_dashboard',
    'ps_public_evaluator_search_external',
    'ps_public_evaluator_add_override',
    'ps_public_evaluator_submit_evaluation',
  ]) {
    assert.match(sql, new RegExp(fn));
  }

  assert.match(
    sql,
    /participation_status\s+IN\s*\([\s\S]*?'pending_confirmation'[\s\S]*?'confirmed'/i
  );

  assert.match(
    sql,
    /ps_evaluator_role_for_assignment[\s\S]*=\s*v_session\.role/i
  );

  assert.match(
    sql,
    /coalesce\(target\.absent,\s*false\)\s*=\s*false/i
  );

  assert.match(
    sql,
    /ps_evaluator_role_for_assignment\([\s\S]*target\.role_value[\s\S]*\)\s+IS NULL/i
  );
});
