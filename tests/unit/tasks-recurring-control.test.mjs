import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const recurringControl = fs.readFileSync(new URL('../../src/components/tasks/RecurringTasksControl.tsx', import.meta.url), 'utf8');
const tasksNav = fs.readFileSync(new URL('../../src/components/tasks/TasksModuleNav.tsx', import.meta.url), 'utf8');
const edge = fs.readFileSync(new URL('../../supabase/functions/process-recurring-tasks/index.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20261005170000_tasks_recurring_control_and_cron_auth.sql', import.meta.url), 'utf8');

test('demandas recorrentes ficam visíveis e editáveis na gestão', () => {
  assert.match(tasksNav, /RecurringTasksControl/);
  assert.match(recurringControl, /Demandas recorrentes/);
  assert.match(recurringControl, /Última geração/);
  assert.match(recurringControl, /Próxima/);
  assert.match(recurringControl, /Execuções/);
  assert.match(recurringControl, /Editar rotina/);
});

test('geração recorrente relaciona instância à rotina e usa segredo do cron', () => {
  assert.match(edge, /recurrence_parent_id: task\.id/);
  assert.match(edge, /\.eq\("recurrence_parent_id", task\.id\)/);
  assert.match(edge, /x-cron-secret/);
  assert.match(migration, /add column if not exists recurrence_parent_id/);
  assert.match(migration, /recurring_tasks_cron_secret/);
  assert.doesNotMatch(migration, /cron_service_role_key/);
});
