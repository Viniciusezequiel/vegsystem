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

test('PDF de pagamentos consulta o banco no momento da exportação e inclui todos os presentes assinados', () => {
  assert.match(payments, /from\('ps_event_collaborators'\)/);
  assert.match(payments, /\.eq\('present', true\)/);
  assert.match(payments, /\.eq\('absent', false\)/);
  assert.match(payments, /\.not\('signed_at', 'is', null\)/);
  assert.match(payments, /const pdfRows = currentSignedLinks\.map/);
  assert.match(payments, /attendance_pix_snapshot \|\| link\.pix/);
  assert.match(payments, /PIX pendente/);
  assert.doesNotMatch(payments, /const pdfRows = readyRows\.map/);
});

test('histórico de confirmação usa Realtime sem polling contínuo', () => {
  assert.match(eventDetail, /staleTime: 5 \* 60 \* 1000/);
  assert.match(eventDetail, /table: 'ps_confirmation_history'/);
  assert.match(eventDetail, /filter: \`event_id=eq\.\$\{id\}\`/);
  assert.match(eventDetail, /queryKey: \['ps-confirmation-history', id\]/);
  assert.match(eventDetail, /refetchOnWindowFocus: false/);
  assert.doesNotMatch(eventDetail, /refetchInterval:/);
});
