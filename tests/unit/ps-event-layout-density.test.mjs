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
const eventPdf = read('src/lib/psEventPdf.ts');
const mainLayout = read('src/components/layout/MainLayout.tsx');
const modernStyles = read('src/styles/process-selection-modern.css');
const dialog = read('src/components/ui/dialog.tsx');
const indexHtml = read('index.html');

test('event summary dashboard is restricted to the overview tab', () => {
  assert.match(detail, /activeTab === 'visao-geral'/);
  assert.match(detail, /<section className="ps-event-stats"/);
});

test('team uses a compact operational table inside the unified communication workspace', () => {
  assert.match(detail, /<PsEventCommunicationTab/);
  assert.match(communication, /<table className="w-full min-w-\[880px\] table-fixed text-sm">/);
  assert.match(communication, />Pessoa<\/th>/);
  assert.match(communication, />Confirmação<\/th>/);
  assert.match(communication, />Envio por e-mail<\/th>/);
  assert.match(communication, />Contato<\/th>/);
  assert.match(communication, /aria-label="Selecionar todos os resultados filtrados"/);
});

test('communication metrics use one compact dashboard surface', () => {
  assert.match(communication, /Acesso rápido/);
  assert.match(communication, /Precisam de ação/);
  assert.match(emailDashboard, /grid-cols-2/);
  assert.match(emailDashboard, /sm:grid-cols-4/);
  assert.equal((emailDashboard.match(/<Card /g) || []).length, 1);
});

test('confirmation report exports only filtered people with delivery status', () => {
  assert.match(communication, /Exportar filtrados/);
  assert.match(communication, /Exportar em PDF/);
  assert.match(communication, /Exportar em Excel/);
  assert.match(detail, /generatePsConfirmationReportPdf\(report\.reportEvent, report\.rows, report\.filters\)/);
  assert.match(detail, /XLSX\.utils\.json_to_sheet\(rows\)/);
  assert.match(detail, /Confirmações filtradas/);
  assert.match(detail, /Status do e-mail/);
  assert.match(detail, /worksheet\['!autofilter'\]/);
  assert.match(detail, /latestEmailByLink/);
  assert.match(eventPdf, /RELATÓRIO DE CONFIRMAÇÕES/);
  assert.match(eventPdf, /email_status_label/);
  assert.match(eventPdf, /Filtros:/);
});

test('confirmation and email operations share one communication workspace', () => {
  assert.match(detail, /<TabsContent value="equipe-comunicacao"/);
  assert.doesNotMatch(detail, /<TabsContent value="confirmacoes"/);
  assert.match(communication, /Copiar mensagem \+ link/);
  assert.match(communication, /Substituir fiscal/);
  assert.match(communication, /Envio por e-mail/);
  assert.doesNotMatch(communication, /Enviar WhatsApp|WATI|WhatsApp Provider/);
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
  assert.match(editDialog, /Celular \/ WhatsApp/);
  assert.match(editDialog, /mobile: form\.mobile \|\| null/);
});

test('tablet and mobile layouts stay inside the viewport', () => {
  assert.match(mainLayout, /w-full min-w-0 max-w-\[1560px\] overflow-x-clip/);
  assert.match(dialog, /w-\[calc\(100%-1rem\)\]/);
  assert.match(dialog, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.doesNotMatch(indexHtml, /user-scalable=no/);
  assert.match(modernStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(modernStyles, /overflow-wrap: anywhere/);
});
