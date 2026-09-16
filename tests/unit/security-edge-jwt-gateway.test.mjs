import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(
  new URL('../../supabase/config.toml', import.meta.url),
  'utf8'
);
const psCommunications = fs.readFileSync(
  new URL('../../supabase/functions/ps-event-communications/index.ts', import.meta.url),
  'utf8'
);

for (const fn of [
  'update-user-email',
  'notify-task-assignment',
]) {
  test(`${fn} exige JWT no gateway`, () => {
    const pattern = new RegExp(
      `\\[functions\\.${fn.replaceAll('-', '\\-')}\\]` +
      `[\\s\\S]*?verify_jwt\\s*=\\s*true`
    );

    assert.match(config, pattern);
  });
}

test('ps-event-communications usa autenticação própria para usuário interno ou worker do cron', () => {
  assert.match(
    config,
    /\[functions\.ps-event-communications\][\s\S]*?verify_jwt\s*=\s*false/
  );
  assert.match(psCommunications, /getClaims/);
  assert.match(psCommunications, /is_internal_user/);
  assert.match(psCommunications, /RECURRING_TASKS_CRON_SECRET/);
  assert.match(psCommunications, /x-cron-secret/);
  assert.match(psCommunications, /action!=='process_queue_worker'/);
});

test('endpoints realmente públicos continuam sem JWT', () => {
  for (const fn of [
    'create-classroom-call',
    'get-classroom-call-config',
    'ps-public-signature',
  ]) {
    const pattern = new RegExp(
      `\\[functions\\.${fn.replaceAll('-', '\\-')}\\]` +
      `[\\s\\S]*?verify_jwt\\s*=\\s*false`
    );

    assert.match(config, pattern);
  }
});
