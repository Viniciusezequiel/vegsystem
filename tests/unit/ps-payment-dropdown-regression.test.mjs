import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('central do processo seletivo nao exibe mensagem interna sobre sidebar', () => {
  const home = read('src/pages/processo-seletivo/PsHome.tsx');
  assert.doesNotMatch(home, /Operação centralizada/i);
  assert.doesNotMatch(home, /sem sobrecarregar o menu lateral/i);
  assert.doesNotMatch(home, /O sidebar continua sendo do VEGSYSTEM/i);
});

test('edicao do colaborador no evento usa modal de cargos cadastrado', () => {
  const detail = read('src/pages/processo-seletivo/PsEventDetail.tsx');
  assert.match(detail, /import \{ PsEventCollaboratorEditDialog \}/);
  assert.match(detail, /<PsEventCollaboratorEditDialog[\s\S]*?roles=\{roles as any\[\]\}/);
  assert.doesNotMatch(detail, /<Label>Função<\/Label><Input value=\{editLink\.role_name/);
});

test('pdf de pagamentos preserva assinatura e detalha novos cargos e totais', () => {
  const pdf = read('src/lib/psPaymentPdf.ts');
  const panel = read('src/components/processo-seletivo/PsEventPaymentsPanel.tsx');

  assert.match(pdf, /preparePdfSignatureRows/);
  assert.match(pdf, /generatePsPaymentsPdfAsync/);
  assert.match(pdf, /ASSINATURA/);
  assert.match(pdf, /FUNÇÃO \/ JORNADA \/ VALOR/);
  assert.match(pdf, /TOTAL GERAL DO EVENTO/);
  assert.match(panel, /select\('id,signature_url'\)/);
  assert.match(panel, /generatePsPaymentsPdfAsync/);
});
