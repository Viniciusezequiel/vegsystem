import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260911183000_ps_event_locations.sql');
const detail = read('src/pages/processo-seletivo/PsEventDetail.tsx');
const locationsTab = read('src/components/processo-seletivo/PsEventLocationsTab.tsx');
const manualDialog = read('src/components/processo-seletivo/PsManualFiscalLinkDialog.tsx');
const snapshot = read('src/lib/psManualEventCollaboratorSnapshot.mjs');
const communications = read('supabase/functions/ps-event-communications/index.ts');
const communicationCore = read('src/lib/psCommunicationCore.mjs');

test('estrutura física não possui nível de bloco', () => {
  assert.match(migration, /ps_locations/);
  assert.match(migration, /ps_location_buildings/);
  assert.match(migration, /ps_location_rooms/);
  assert.doesNotMatch(migration, /block_id|ps_location_blocks/);
});

test('importador oficial usa Local, Endereço, Prédio, Andar, Sala e Capacidade', () => {
  for (const header of ['Local', 'Endereço', 'Prédio', 'Andar', 'Sala', 'Capacidade']) assert.match(locationsTab, new RegExp(header));
  assert.match(locationsTab, /modelo-locais-processo-seletivo\.xlsx/);
  assert.match(locationsTab, /ps_admin_import_event_locations/);
});

test('evento possui aba de locais e opção de edição', () => {
  assert.match(detail, /TabsTrigger value="locais">Locais/);
  assert.match(detail, /PsEventLocationsTab/);
  assert.match(detail, /Editar evento/);
  assert.match(detail, /PsEventEditDialog/);
});

test('vinculação manual usa dropdown em cascata da estrutura cadastrada', () => {
  assert.match(manualDialog, /Local \/ Campus/);
  assert.match(manualDialog, /Prédio/);
  assert.match(manualDialog, /Andar/);
  assert.match(manualDialog, /Sala \/ ambiente/);
  assert.match(manualDialog, /usePsEventLocationStructure/);
  assert.doesNotMatch(manualDialog, /placeholder="Campus Fumec"/);
});

test('vínculo mantém ids estruturados e snapshots usados pelos fluxos existentes', () => {
  for (const field of ['location_id', 'building_id', 'room_id', 'location_address', 'campus', 'building', 'floor', 'room']) assert.match(snapshot, new RegExp(field));
});

test('endereço fica disponível no conteúdo e no cartão dos e-mails sem alterar provedor', () => {
  assert.match(communications, /endereco:link\.location_address/);
  assert.match(communicationCore, /Endereço: \{\{endereco\}\}/);
  assert.match(communications, /configuredEmailProvider/);
  assert.match(communications, /PS_EMAIL_DAILY_LIMIT/);
});
