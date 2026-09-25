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

test('histórico de confirmação usa Realtime sem polling contínuo', () => {
  assert.match(eventDetail, /staleTime: 5 \* 60 \* 1000/);
  assert.match(eventDetail, /table: 'ps_confirmation_history'/);
  assert.match(eventDetail, /filter: \`event_id=eq\.\$\{id\}\`/);
  assert.match(eventDetail, /queryKey: \['ps-confirmation-history', id\]/);
  assert.match(eventDetail, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(eventDetail, /refetchInterval:/);
});
