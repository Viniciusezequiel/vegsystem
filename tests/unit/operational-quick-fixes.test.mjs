import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const collaboratorsSource = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsCollaborators.tsx', import.meta.url), 'utf8');
const eventDetailSource = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const storageSuggestionSource = fs.readFileSync(new URL('../../src/lib/lostItemStorageSuggestion.ts', import.meta.url), 'utf8');
const registerItemSource = fs.readFileSync(new URL('../../src/pages/RegisterItem.tsx', import.meta.url), 'utf8');
const equipmentSource = fs.readFileSync(new URL('../../src/hooks/useEquipment.ts', import.meta.url), 'utf8');

test('badge de observação aparece na lista de fiscais quando há notas', () => {
  assert.match(collaboratorsSource, /String\(c\.notes \|\| ''\)\.trim\(\) !== ''/);
  assert.match(collaboratorsSource, /Badge[^\n]*Observa[cçã]/i);
});

test('vinculação manual exige PIX preenchido antes de salvar', () => {
  assert.match(eventDetailSource, /if \(!selected\.length \|\| !roleValue \|\| !campusValue\.trim\(\)\)/);
  assert.doesNotMatch(eventDetailSource, /pix\s*\|\|\s*'Sem PIX'/i);
  assert.match(eventDetailSource, /preparePixPlan/);
  assert.match(eventDetailSource, /buildManualEventCollaboratorRow\([\s\S]*pix/i);
});

test('fallback de categoria de armazenamento usa descrição quando a IA não aporta dado', () => {
  assert.match(storageSuggestionSource, /inferLostItemStorageCategory/i);
  assert.match(registerItemSource, /effectiveStorageCategory|resolvedStorageCategory/i);
  assert.match(registerItemSource, /storageManualOverride.*false|setStorageManualOverride\(true\)/i);
});

test('empréstimo manual sem equipamento é suportado em lote e devolução', () => {
  assert.match(equipmentSource, /manual_item_name/i);
  assert.match(equipmentSource, /equipment_id:\s*string\s*\|\s*null/i);
  assert.match(equipmentSource, /loanStockNeeded\(items\)/);
  assert.match(equipmentSource, /loan\.equipment_id\s*\?\?/i);
});
