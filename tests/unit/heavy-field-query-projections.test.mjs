import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const constantBody = (source, name) => source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]\\.join\\(','\\);`))?.[1] ?? '';

test('equipment loan list projection excludes Base64 signatures and detail remains explicit', () => {
  const source = read('src/hooks/useEquipment.ts');
  const projection = constantBody(source, 'EQUIPMENT_LOAN_LIST_SELECT');
  assert.ok(projection);
  assert.doesNotMatch(projection, /borrower_signature|return_signature|['"]\*['"]/);
  assert.match(source, /queryKey: \['equipment-loan-detail', id\][\s\S]*?select\('\*, equipment\(\*\)'\)/);
});

test('locker loan list projection excludes Base64 signatures and detail remains explicit', () => {
  const source = read('src/hooks/useLockers.ts');
  const projection = constantBody(source, 'LOCKER_LOAN_LIST_SELECT');
  assert.ok(projection);
  assert.doesNotMatch(projection, /borrower_signature|return_signature|['"]\*['"]/);
  assert.match(source, /queryKey: \['locker-loan-detail', id\][\s\S]*?select\('\*, locker:lockers\(\*\)'\)/);
});

test('process selection list excludes signature URL and PDF loads it on demand', () => {
  const hook = read('src/hooks/useProcessoSeletivo.ts');
  const page = read('src/pages/processo-seletivo/PsEventDetail.tsx');
  const projection = constantBody(hook, 'PS_EVENT_COLLABORATOR_LIST_SELECT');
  assert.ok(projection);
  assert.doesNotMatch(projection, /signature_url|['"]\*['"]/);
  assert.match(page, /exportAttendancePdf = async[\s\S]*?select\('id, signature_url'\)/);
});

test('lost-item non-detail reads do not select owner signature', () => {
  const logs = read('src/hooks/useLostItemLogs.ts');
  const archive = read('src/components/items/ArchiveDeliveredItemsDialog.tsx');
  assert.doesNotMatch(logs, /select\(['"]\*['"]\)/);
  assert.doesNotMatch(logs.match(/\.select\(([^)]*)\)/)?.[1] ?? '', /owner_signature/);
  const initialArchiveRead = archive.slice(0, archive.indexOf('const archiveItems'));
  assert.doesNotMatch(initialArchiveRead, /select\(['"]\*['"]\)|owner_signature/);
  assert.match(archive, /explicit archive operation[\s\S]*?select\('\*'\)/);
});

test('persistent equipment list cache strips signatures', () => {
  const source = read('src/lib/equipmentCache.ts');
  assert.match(source, /borrower_signature: _borrowerSignature/);
  assert.match(source, /return_signature: _returnSignature/);
  assert.match(source, /CACHE_VERSION = 2/);
});
