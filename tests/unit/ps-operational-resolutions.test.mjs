import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const detail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260930101500_ps_operational_manual_resolutions.sql', import.meta.url), 'utf8');

test('pendências operacionais aceitam intervenção manual auditável', () => {
  assert.match(detail, /ps_event_operational_resolutions/);
  assert.match(detail, /ps_set_event_operational_resolution/);
  assert.match(detail, /ps_clear_event_operational_resolution/);
  assert.match(detail, /Intervenção manual/);
  assert.match(detail, /Justificativa obrigatória/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /public\.is_admin\(auth\.uid\(\)\)/);
  assert.match(migration, /resolution_reason_required/);
  assert.match(migration, /revoked_at/);
});
