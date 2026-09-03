import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fn = fs.readFileSync(
  new URL(
    '../../supabase/functions/setup-first-admin/index.ts',
    import.meta.url
  ),
  'utf8'
);

const config = fs.readFileSync(
  new URL('../../supabase/config.toml', import.meta.url),
  'utf8'
);

const app = fs.readFileSync(
  new URL('../../src/App.tsx', import.meta.url),
  'utf8'
);

test('bootstrap administrativo retorna 410', () => {
  assert.match(fn, /status:\s*410/);
  assert.match(fn, /bootstrap_disabled/);
});

test('bootstrap não utiliza mais service role', () => {
  assert.doesNotMatch(
    fn,
    /SUPABASE_SERVICE_ROLE_KEY/
  );

  assert.doesNotMatch(
    fn,
    /auth\.admin\.createUser/
  );
});

test('setup-first-admin não possui verify_jwt false', () => {
  assert.doesNotMatch(
    config,
    /\[functions\.setup-first-admin\][\s\S]*?verify_jwt\s*=\s*false/
  );
});

test('rota /setup não exibe formulário de bootstrap', () => {
  assert.doesNotMatch(
    app,
    /element=\{<Setup\s*\/>\}/
  );

  assert.match(
    app,
    /path="\/setup"[\s\S]*Navigate[\s\S]*\/admin-auth/
  );
});
