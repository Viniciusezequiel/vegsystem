import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const training = fs.readFileSync(
  new URL('../../src/components/processo-seletivo/PsEventTrainingTab.tsx', import.meta.url),
  'utf8'
);

const payments = fs.readFileSync(
  new URL('../../src/components/processo-seletivo/PsEventPaymentsPanel.tsx', import.meta.url),
  'utf8'
);

const eventDetail = fs.readFileSync(
  new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url),
  'utf8'
);

test('treinamentos contam somente fiscais operacionais', () => {
  assert.match(training, /\['pending_confirmation', 'confirmed'\]\.includes/);
  assert.match(training, /const operationalChoices = useMemo/);
  assert.match(training, /trainingOperationalLinkIds\.has/);
  assert.match(training, /const groupChoices = operationalChoices\.filter/);
});

test('PDF de pagamentos exporta somente quem está pronto e preserva PIX da presença', () => {
  assert.match(payments, /if \(!readyRows\.length \|\| exportingPdf\) return/);
  assert.match(payments, /const ids = readyRows\.map/);
  assert.match(payments, /const pdfRows = readyRows\.map/);
  assert.match(payments, /attendance_pix_snapshot \|\| row\.link\.pix/);
  assert.doesNotMatch(payments, /const pdfRows = payableRows\.map/);
});

test('histórico de confirmação não faz polling agressivo em segundo plano', () => {
  assert.match(eventDetail, /staleTime: 15_000/);
  assert.match(eventDetail, /activeTab === 'equipe-comunicacao' \? 30_000 : false/);
  assert.match(eventDetail, /refetchIntervalInBackground: false/);
  assert.doesNotMatch(eventDetail, /refetchInterval:\s*5000/);
});
