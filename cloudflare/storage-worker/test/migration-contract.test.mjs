import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(new URL('../../../migracao/19-r2-storage-authz.sql', import.meta.url), 'utf8');

test('RPC é self-scoped e rejeita auth.uid ausente', () => {
  assert.match(sql, /FUNCTION public\.get_my_storage_access\(\)/);
  assert.match(sql, /v_user_id := auth\.uid\(\)/);
  assert.match(sql, /IF v_user_id IS NULL THEN/);
  assert.match(sql, /ERRCODE = '42501'/);
  assert.doesNotMatch(sql, /get_my_storage_access\s*\([^)]*uuid/i);
});

test('RPC retorna apenas internal e roles do próprio usuário', () => {
  assert.match(sql, /WHERE ur\.user_id = v_user_id/);
  assert.match(sql, /'internal'/);
  assert.match(sql, /'roles'/);
  assert.doesNotMatch(sql, /email|full_name|display_name/i);
});

test('RPC fixa segurança e grants mínimos', () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog/);
  assert.match(sql, /OWNER TO postgres/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_my_storage_access\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_my_storage_access\(\) TO authenticated/);
});
