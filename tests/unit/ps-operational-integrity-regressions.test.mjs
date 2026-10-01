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


test('PDF de presença consulta lista operacional completa e identifica status', () => {
  assert.match(detail, /\.eq\('manually_excluded', false\)/);
  assert.match(detail, /\.in\('participation_status', \['pending_confirmation', 'confirmed'\]\)/);
  assert.match(detail, /attendanceStatus/);
  assert.match(detail, /PRESENTE \/ ASSINADO/);
  assert.match(detail, /NÃO ASSINOU/);
  assert.match(detail, /row\.absent\s*\?\s*null/);
  assert.match(pdf, /label: 'STATUS'/);
  assert.match(pdf, /attendance_status/);
});


test('pagamentos classificam automaticamente e permitem decisão manual auditável', () => {
  assert.match(payments, /automaticDecision/);
  assert.match(payments, /Presença e assinatura estão divergentes/);
  assert.match(payments, /ajuste\(s\) ainda precisam de conferência/);
  assert.match(payments, /ps_event_payment_decision_overrides/);
  assert.match(payments, /ps_set_payment_decision_override/);
  assert.match(payments, /ps_clear_payment_decision_override/);
  assert.match(payments, /Intervenção manual no pagamento/);
  assert.match(payments, /Justificativa obrigatória/);
});


test('PDFs de presença e pagamento validam integridade antes de salvar', () => {
  assert.match(payments, /Falha de integridade/);
  assert.match(payments, /sourceIds/);
  assert.match(payments, /preparedIds/);
  assert.match(detail, /missingIds/);
  assert.match(detail, /Falha de integridade/);
});
