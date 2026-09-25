import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const psHook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');
const tasks = fs.readFileSync(new URL('../../src/hooks/useTaskNotifications.ts', import.meta.url), 'utf8');
const realtime = fs.readFileSync(new URL('../../src/hooks/useRealtimeSubscription.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260925195000_ps_communication_realtime_payload.sql', import.meta.url), 'utf8');

test('comunicações aplicam broadcast incremental sem refetch completo por status', () => {
  assert.match(migration, /'row',\s*jsonb_build_object/);
  assert.match(migration, /provider_last_event_at/);
  assert.match(psHook, /const row = change\?\.row/);
  assert.match(psHook, /qc\.getQueryData<any\[]>\(queryKey\)/);
  assert.match(psHook, /qc\.setQueryData\(queryKey, next\)/);
});

test('notificações de tarefas não assinam UPDATE global duplicado', () => {
  assert.match(tasks, /select\('id', \{ count: 'exact', head: true \}\)/);
  assert.doesNotMatch(tasks, /task-reassign-notifications/);
  assert.doesNotMatch(tasks, /event: 'UPDATE',[\s\S]*table: 'tasks',[\s\S]*\n\s*\},\n\s*\(payload\)/);
});

test('histórico de atividades não é transmitido globalmente por realtime', () => {
  const globalList = realtime.match(/const allTables: TableName\[] = \[([\s\S]*?)\n\s*\];/)?.[1] || '';
  assert.doesNotMatch(globalList, /'activity_logs'/);
  assert.match(globalList, /'classroom_calls'/);
});
