import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodePngDataUrl, inventoryEntry, parseArgs, summarizeEntries } from '../../scripts/migrate-signatures-to-r2.mjs';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const dataUrl = `data:image/png;base64,${png.toString('base64')}`;

test('CLI exige equipment e um único modo; resume retoma execução', () => {
  assert.deepEqual(parseArgs(['--module', 'equipment', '--dry-run']), {
    module: 'equipment', dryRun: true, execute: false, resume: false,
  });
  assert.deepEqual(parseArgs(['--module', 'lockers', '--dry-run']), {
    module: 'lockers', dryRun: true, execute: false, resume: false,
  });
  assert.deepEqual(parseArgs(['--module', 'lost-items', '--dry-run']), {
    module: 'lost-items', dryRun: true, execute: false, resume: false,
  });
  assert.deepEqual(parseArgs(['--module', 'equipment', '--execute', '--resume']), {
    module: 'equipment', dryRun: false, execute: true, resume: true,
  });
  assert.deepEqual(parseArgs(['--module', 'equipment', '--resume']), {
    module: 'equipment', dryRun: false, execute: true, resume: true,
  });
  assert.throws(() => parseArgs(['--module', 'process-selection', '--dry-run']), /unsupported_module/);
});

test('aceita somente Base64 PNG canônico com magic bytes', () => {
  assert.equal(decodePngDataUrl(dataUrl).valid, true);
  assert.equal(decodePngDataUrl('data:image/jpeg;base64,/9j/').status, 'invalid_data_url');
  assert.equal(decodePngDataUrl(`data:image/png;base64,${Buffer.alloc(12).toString('base64')}`).status, 'invalid_png_magic');
  assert.equal(decodePngDataUrl('data:image/png;base64,%%%=').status, 'invalid_base64');
});

test('inventário não persiste Base64 e contabiliza campos e duplicidades por SHA', () => {
  const entries = [
    inventoryEntry('loan-a', 'borrower_signature', dataUrl, '2026-09-01T00:00:00.000Z'),
    inventoryEntry('loan-b', 'return_signature', dataUrl, '2026-09-01T00:00:00.000Z'),
    inventoryEntry('loan-c', 'return_signature', 'invalid', '2026-09-01T00:00:00.000Z'),
  ];
  const serialized = JSON.stringify(entries);
  assert.equal(serialized.includes('data:image'), false);
  const summary = summarizeEntries(entries);
  assert.deepEqual({ borrower: summary.borrower_found, returned: summary.return_found, total: summary.total }, {
    borrower: 1, returned: 2, total: 3,
  });
  assert.equal(summary.valid, 2);
  assert.equal(summary.invalid, 1);
  assert.equal(summary.duplicate_groups, 1);
  assert.equal(summary.duplicate_extra_occurrences, 1);
});

test('inventário de lost-items preserva origem sem persistir Base64', () => {
  const active = inventoryEntry('active-id', 'owner_signature', dataUrl, '2026-09-01T00:00:00.000Z', 'active');
  const archive = inventoryEntry('archive-id', 'owner_signature', dataUrl, '2026-09-01T00:00:00.000Z', 'archive');
  assert.deepEqual({ id: active.record_id, source: active.source }, { id: 'active-id', source: 'active' });
  assert.equal('loan_id' in active, false);
  const summary = summarizeEntries([active, archive]);
  assert.deepEqual({ active: summary.active_found, archive: summary.archive_found }, { active: 1, archive: 1 });
  assert.equal(JSON.stringify([active, archive]).includes('data:image'), false);
});

test('executor contém guardas de sequência, update condicionado e cleanup exato', () => {
  const source = fs.readFileSync(new URL('../../scripts/migrate-signatures-to-r2.mjs', import.meta.url), 'utf8');
  assert.match(source, /for \(const entry of manifest\.entries\)/);
  assert.match(source, /rpc\/\$\{config\.module\.rpc\}/);
  assert.match(source, /p_expected_value: original/);
  assert.doesNotMatch(source, /\$\{entry\.field\}=eq\.\$\{encodeURIComponent\(original\)\}/);
  assert.match(source, /databaseValue === current/);
  assert.match(source, /exactReferenceCount/);
  assert.doesNotMatch(source, /delete.*prefix|deleteAll|localStorage|sessionStorage/i);
});

test('RPC é invoker, estática, restrita e retorna contagem para concorrência', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901133000_update_equipment_signature_locator_rpc.sql', import.meta.url), 'utf8');
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /p_field = 'borrower_signature'/);
  assert.match(sql, /p_field = 'return_signature'/);
  assert.match(sql, /borrower_signature = p_expected_value/);
  assert.match(sql, /return_signature = p_expected_value/);
  assert.match(sql, /p_new_locator NOT LIKE 'r2\/signatures\/equipment\/%'/);
  assert.match(sql, /GET DIAGNOSTICS v_rows_updated = ROW_COUNT/);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM PUBLIC/);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO authenticated/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|EXECUTE\s+format|service_role/i);
});

test('RPC de lockers mantém o mesmo contrato invoker sem SQL dinâmico', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901150000_update_locker_signature_locator_rpc.sql', import.meta.url), 'utf8');
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /UPDATE public\.locker_loans[\s\S]*borrower_signature = p_expected_value/);
  assert.match(sql, /UPDATE public\.locker_loans[\s\S]*return_signature = p_expected_value/);
  assert.match(sql, /p_new_locator NOT LIKE 'r2\/signatures\/lockers\/%'/);
  assert.match(sql, /GET DIAGNOSTICS v_rows_updated = ROW_COUNT/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|EXECUTE\s+format|service_role/i);
});

test('RPC de lost-items é invoker e escolhe somente active/archive sem SQL dinâmico', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901170000_update_lost_item_signature_locator_rpc.sql', import.meta.url), 'utf8');
  assert.match(sql, /SECURITY INVOKER/i);
  assert.match(sql, /p_source = 'active'[\s\S]*UPDATE public\.lost_items/);
  assert.match(sql, /p_source = 'archive'[\s\S]*UPDATE public\.lost_items_archive/);
  assert.match(sql, /owner_signature = p_expected_value/g);
  assert.match(sql, /p_new_locator NOT LIKE 'r2\/signatures\/lost-items\/%'/);
  assert.match(sql, /GET DIAGNOSTICS v_rows_updated = ROW_COUNT/);
  assert.doesNotMatch(sql, /SECURITY DEFINER|EXECUTE\s+format|service_role/i);
});
