import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const migrationName = '20260908154942_restrict_internal_process_selection_functions.sql';
const read = path => readFileSync(new URL(path, root), 'utf8');
const stripComments = sql => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const normalize = sql => sql.replace(/\s+/g, ' ').trim().toLowerCase();
const statements = stripComments(read(`supabase/migrations/${migrationName}`))
  .split(';').map(normalize).filter(Boolean);
const targets = [
  'ps_notify_event_roster_changed(uuid)',
  'ps_event_collaborators_realtime_broadcast()',
  'ps_record_confirmation_history()',
];

for (const signature of targets) {
  test(`${signature}: revoga PUBLIC e os dois grants explícitos da Data API`, () => {
    for (const role of ['public', 'anon', 'authenticated']) {
      assert.ok(statements.includes(`revoke all on function public.${signature} from ${role}`));
    }
  });
}

test('hardening altera exclusivamente nove ACLs autorizadas numa transação', () => {
  assert.deepEqual(statements, [
    'begin',
    ...targets.flatMap(signature => ['public', 'anon', 'authenticated']
      .map(role => `revoke all on function public.${signature} from ${role}`)),
    'commit',
  ]);
});

const migrations = readdirSync(new URL('supabase/migrations/', root))
  .filter(name => name.endsWith('.sql')).sort();
const priorSql = normalize(stripComments(migrations.filter(name => name < migrationName)
  .map(name => read(`supabase/migrations/${name}`)).join('\n')));

test('triggers mantêm os vínculos e funções internas continuam SECURITY DEFINER', () => {
  for (const [trigger, fn] of [
    ['ps_event_collaborators_realtime_broadcast', 'ps_event_collaborators_realtime_broadcast'],
    ['ps_event_collaborators_confirmation_history', 'ps_record_confirmation_history'],
  ]) {
    const definitions = [...priorSql.matchAll(new RegExp(`create (?:or replace )?trigger ${trigger}\\b[^;]+;`, 'g'))];
    assert.ok(definitions.length > 0);
    assert.match(definitions.at(-1)[0], new RegExp(`on public\\.ps_event_collaborators .*execute function public\\.${fn}\\(\\)`));
  }
  for (const signature of targets) {
    const name = signature.split('(')[0];
    const definitions = [...priorSql.matchAll(new RegExp(`create or replace function public\\.${name}\\([^]*?as \\$\\$`, 'g'))];
    assert.ok(definitions.length > 0);
    assert.match(definitions.at(-1)[0], /security definer/);
  }
  assert.ok(priorSql.includes('perform public.ps_notify_event_roster_changed(v_event_id)'));
});

test('RPCs públicas legítimas conservam os grants anon/authenticated', () => {
  for (const signature of [
    'ps_public_get_event_collaborator_confirmation(uuid, text)',
    'ps_public_set_event_collaborator_confirmation(uuid, text, text, text)',
    'ps_public_list_events(text)',
    'ps_public_list_roles()',
  ]) {
    assert.ok(priorSql.includes(`grant execute on function public.${signature} to anon, authenticated`), signature);
    assert.ok(!statements.some(statement => statement.includes(signature)));
  }
});

test('RPCs administrativas conservam EXECUTE para authenticated', () => {
  for (const signature of [
    'ps_event_collaborator_confirmation_summary(uuid)',
    'ps_request_event_collaborator_confirmation(uuid, boolean, interval)',
    'ps_replace_event_collaborator(uuid, uuid, jsonb)',
  ]) {
    assert.ok(priorSql.includes(`grant execute on function public.${signature} to authenticated`), signature);
    assert.ok(!statements.some(statement => statement.includes(signature)));
  }
});

test('frontend não usa as funções internas como RPCs', () => {
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) inspect(path);
      else if (/\.(tsx?|m?js)$/.test(entry.name)) {
        const source = readFileSync(path, 'utf8');
        for (const signature of targets) {
          assert.ok(!source.includes(signature.split('(')[0]), `${path.pathname}: referência interna`);
        }
      }
    }
  }
  inspect(new URL('src/', root));
});
