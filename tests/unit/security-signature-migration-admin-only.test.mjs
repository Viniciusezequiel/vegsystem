import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902480000_security_signature_migration_admin_only.sql',
    import.meta.url
  ),
  'utf8'
);

const functions = [
  'update_equipment_signature_locator',
  'update_locker_signature_locator',
  'update_lost_item_signature_locator',
  'update_process_selection_signature_locator',
];

test('RPCs de migração continuam SECURITY INVOKER', () => {
  const matches = sql.match(/SECURITY INVOKER/g) ?? [];

  assert.equal(matches.length, 4);
});

test('RPCs exigem admin autenticado', () => {
  const checks = sql.match(
    /NOT public\.is_admin\(auth\.uid\(\)\)/g
  ) ?? [];

  assert.equal(checks.length, 4);
});

test('service_role continua permitido para manutenção', () => {
  const checks = sql.match(
    /current_user <> 'service_role'/g
  ) ?? [];

  assert.equal(checks.length, 4);
});

test('nenhuma RPC é liberada para anon', () => {
  for (const fn of functions) {
    assert.match(
      sql,
      new RegExp(
        `REVOKE ALL ON FUNCTION[\\s\\S]*${fn}`
      )
    );
  }
});
