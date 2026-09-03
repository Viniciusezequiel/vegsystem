import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902430000_ps_public_metadata_rpcs.sql',
    import.meta.url
  ),
  'utf8'
);

const attendance = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx',
    import.meta.url
  ),
  'utf8'
);

const selfEvaluation = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicSelfEvaluation.tsx',
    import.meta.url
  ),
  'utf8'
);

test('metadados públicos são expostos apenas por RPCs mínimos', () => {
  assert.match(sql, /ps_public_list_events/);
  assert.match(sql, /ps_public_list_roles/);

  assert.match(
    sql,
    /REVOKE SELECT ON public\.ps_events FROM anon/
  );

  assert.match(
    sql,
    /REVOKE SELECT ON public\.ps_roles FROM anon/
  );

  assert.doesNotMatch(
    sql.match(
      /CREATE OR REPLACE FUNCTION public\.ps_public_list_roles[\s\S]*?\$\$;/
    )?.[0] || '',
    /pay_value|combined_roles/i
  );
});

test('presença e autoavaliação não dependem das tabelas internas de evento/cargo', () => {
  for (const source of [attendance, selfEvaluation]) {
    assert.match(source, /ps_public_list_events/);
    assert.match(source, /ps_public_list_roles/);

    assert.doesNotMatch(source, /usePsEvents/);
    assert.doesNotMatch(source, /usePsRoles/);

    assert.doesNotMatch(
      source,
      /\.from\(['"]ps_events['"]\)/
    );

    assert.doesNotMatch(
      source,
      /\.from\(['"]ps_roles['"]\)/
    );
  }
});
