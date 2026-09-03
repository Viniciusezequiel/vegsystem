import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902460000_security_retire_legacy_public_surfaces.sql',
    import.meta.url
  ),
  'utf8'
);

test('schema public não permite CREATE para usuários da aplicação', () => {
  assert.match(
    sql,
    /REVOKE CREATE[\s\S]*ON SCHEMA public[\s\S]*PUBLIC[\s\S]*anon[\s\S]*authenticated/i
  );
});

test('novas funções não recebem EXECUTE público por padrão', () => {
  assert.match(
    sql,
    /ALTER DEFAULT PRIVILEGES[\s\S]*REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i
  );
});

test('roster legado deixa de ser RPC pública', () => {
  assert.match(
    sql,
    /ps_public_event_roster\(uuid\)[\s\S]*FROM PUBLIC,\s*anon,\s*authenticated/i
  );

  assert.match(
    sql,
    /ps_public_event_roster\(uuid\)[\s\S]*TO service_role/i
  );
});

test('retificação legada não aceita insert anônimo', () => {
  assert.match(
    sql,
    /ps_evaluation_retifications[\s\S]*FROM anon/i
  );

  assert.match(
    sql,
    /DROP POLICY IF EXISTS[\s\S]*ps_retif public insert validated/i
  );
});
