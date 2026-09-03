import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902470000_security_default_privileges_deny.sql',
    import.meta.url
  ),
  'utf8'
);

test('funções novas não são automaticamente públicas', () => {
  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES[\s\S]*ON FUNCTIONS[\s\S]*FROM anon/i
  );

  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES[\s\S]*ON FUNCTIONS[\s\S]*FROM authenticated/i
  );

  assert.match(
    sql,
    /ON FUNCTIONS[\s\S]*FROM PUBLIC/i
  );
});

test('tabelas novas usam default deny', () => {
  assert.match(
    sql,
    /ON TABLES[\s\S]*FROM anon/i
  );

  assert.match(
    sql,
    /ON TABLES[\s\S]*FROM authenticated/i
  );
});

test('sequences novas usam default deny', () => {
  assert.match(
    sql,
    /ON SEQUENCES[\s\S]*FROM anon/i
  );

  assert.match(
    sql,
    /ON SEQUENCES[\s\S]*FROM authenticated/i
  );
});

test('usuários da aplicação não criam objetos no schema public', () => {
  assert.match(
    sql,
    /REVOKE CREATE[\s\S]*ON SCHEMA public[\s\S]*anon[\s\S]*authenticated/i
  );
});
