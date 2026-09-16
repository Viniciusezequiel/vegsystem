import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const detail = read('src/pages/processo-seletivo/PsEventDetail.tsx');
const communication = read('src/components/processo-seletivo/PsEventCommunicationTab.tsx');
const emailDashboard = read('src/components/processo-seletivo/PsEmailTrackingDashboard.tsx');
const events = read('src/pages/processo-seletivo/PsEvents.tsx');
const editDialog = read('src/components/processo-seletivo/PsEventCollaboratorEditDialog.tsx');
const mainLayout = read('src/components/layout/MainLayout.tsx');
const modernStyles = read('src/styles/process-selection-modern.css');

test('event summary dashboard is restricted to the overview tab', () => {
  assert.match(detail, /activeTab === 'visao-geral'/);
  assert.match(detail, /<section className="ps-event-stats"/);
});

test('team uses a compact operational list instead of person cards', () => {
  assert.match(detail, /Fiscal<\/span>/);
  assert.match(detail, /Situação<\/span>/);
  assert.match(detail, /xl:grid-cols-\[minmax\(230px,1\.4fr\)_minmax\(210px,1fr\)_auto_auto\]/);
  assert.match(detail, /aria-label=\{`Editar \$\{l\.collaborator_name\}`\}/);
});

test('communication metrics use one compact dashboard surface', () => {
  assert.match(communication, /Mensagens, confirmações e acompanhamento dos envios/);
  assert.match(emailDashboard, /grid-cols-2/);
  assert.match(emailDashboard, /sm:grid-cols-4/);
  assert.equal((emailDashboard.match(/<Card /g) || []).length, 1);
});

test('process selection uses the available width and events fill their grid', () => {
  assert.match(mainLayout, /processo-seletivo'\) && 'max-w-\[1800px\]'/);
  assert.match(events, /className="ps-events-grid"/);
  assert.match(modernStyles, /repeat\(auto-fit, minmax\(min\(100%, 430px\), 1fr\)\)/);
});

test('event collaborator editing is separated into clear sections', () => {
  for (const section of ['Atuação', 'Dados', 'Local', 'Financeiro']) {
    assert.match(editDialog, new RegExp(`>${section}<`));
  }
  assert.match(editDialog, /As alterações abaixo valem para este evento/);
  assert.match(editDialog, /Salvar alterações/);
});
