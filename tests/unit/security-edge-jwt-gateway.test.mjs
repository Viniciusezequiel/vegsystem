import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(
  new URL('../../supabase/config.toml', import.meta.url),
  'utf8'
);

for (const fn of [
  'update-user-email',
  'notify-task-assignment',
  'ps-event-communications',
]) {
  test(`${fn} exige JWT no gateway`, () => {
    const pattern = new RegExp(
      `\\[functions\\.${fn.replaceAll('-', '\\-')}\\]` +
      `[\\s\\S]*?verify_jwt\\s*=\\s*true`
    );

    assert.match(config, pattern);
  });
}

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
