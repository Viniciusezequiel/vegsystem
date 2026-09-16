import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const edge=fs.readFileSync(new URL('../../supabase/functions/ps-event-communications/index.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../../supabase/migrations/20260916011000_ps_event_communications_auto_worker.sql',import.meta.url),'utf8');

test('fila de comunicação possui worker automático protegido por segredo de cron',()=>{
  assert.match(edge,/process_queue_worker/);
  assert.match(edge,/RECURRING_TASKS_CRON_SECRET/);
  assert.match(edge,/x-cron-secret/);
  assert.match(edge,/EdgeRuntime/);
  assert.match(edge,/scheduleWorker/);
});

test('worker não reprocessa cota do mesmo dia e cron retoma filas elegíveis',()=>{
  assert.match(edge,/waiting_provider_quota/);
  assert.match(edge,/\.lt\('provider_quota_date',quotaDate\)/);
  assert.match(migration,/invoke_ps_event_communications_worker/);
  assert.match(migration,/ps-event-communications-auto-worker/);
  assert.match(migration,/\* \* \* \* \*/);
  assert.match(migration,/provider_quota_date < v_today/);
});
