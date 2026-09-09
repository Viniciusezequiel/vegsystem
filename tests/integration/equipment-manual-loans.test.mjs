// Local disposable PostgreSQL only. Run with: node --test tests/integration/equipment-manual-loans.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

test('manual loan migration accepts mixed items and preserves FK/check constraints', async () => {
  const container = execFileSync('docker', ['run','--rm','-d','--network','none','--user','postgres','--entrypoint','/bin/bash',
    'public.ecr.aws/supabase/postgres:17.6.1.155','-c',
    'initdb -D /tmp/loan-test-db -A trust --no-locale -E UTF8 && exec postgres -D /tmp/loan-test-db -k /tmp -c listen_addresses='], {encoding:'utf8'}).trim();
  const sql = input => execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-h','/tmp','-U','postgres','-v','ON_ERROR_STOP=1'], {input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  try {
    let ready=false;
    for(let i=0;i<60;i++) { try { sql('SELECT 1'); ready=true; break; } catch { await setTimeout(250); } }
    assert.ok(ready);
    sql('CREATE TABLE equipment(id uuid PRIMARY KEY); CREATE TABLE equipment_loans(id integer PRIMARY KEY, equipment_id uuid NOT NULL REFERENCES equipment(id));');
    sql(readFileSync(new URL('../../supabase/migrations/20260909004643_equipment_manual_loan_items.sql',import.meta.url),'utf8'));
    sql("INSERT INTO equipment VALUES ('11111111-1111-1111-1111-111111111111'); INSERT INTO equipment_loans VALUES (1,'11111111-1111-1111-1111-111111111111',NULL),(2,NULL,'Chave sala 601');");
    assert.equal(sql('SELECT count(*) FROM equipment_loans'),'2');
    assert.throws(()=>sql("INSERT INTO equipment_loans VALUES (3,NULL,' ');"));
    assert.throws(()=>sql('INSERT INTO equipment_loans VALUES (3,NULL,NULL);'));
    assert.throws(()=>sql("INSERT INTO equipment_loans VALUES (3,'22222222-2222-2222-2222-222222222222',NULL);"));
    assert.equal(sql("SELECT count(*) FROM pg_constraint WHERE conrelid='equipment_loans'::regclass AND contype='f'"),'1');
  } finally { execFileSync('docker',['rm','-f',container],{stdio:'ignore'}); }
});
