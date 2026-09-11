import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFiscalEmail,
  normalizeFiscalMatricula,
  normalizeFiscalInstitution,
  normalizeFiscalCpf,
  isValidFiscalCpf,
  extractFiscalBankRows,
  dedupeFiscalRows,
  buildFiscalImportFingerprint,
  renderFiscalTemplate,
  extractFiscalImportedHistory,
  mergeFiscalImportedHistory,
} from '../../src/lib/psFiscalBank.mjs';

test('normaliza e-mail e matrícula sem criar duplicação por caixa/espaco', () => {
  assert.equal(normalizeFiscalEmail('  Fulano.Silva@EMPRESA.ORG.BR  '), 'fulano.silva@empresa.org.br');
  assert.equal(normalizeFiscalMatricula('  00123/AB '), '00123ab');
  assert.equal(normalizeFiscalInstitution('  Faculdade   de  Medicina  '), 'faculdade de medicina');
});

test('normaliza e valida CPF brasileiro sem aceitar números artificiais', () => {
  assert.equal(normalizeFiscalCpf('116.480.266-64'), '116.480.266-64');
  assert.equal(normalizeFiscalCpf('11648026664'), '116.480.266-64');
  assert.equal(isValidFiscalCpf('116.480.266-64'), true);
  assert.equal(isValidFiscalCpf('111.111.111-11'), false);
  assert.equal(normalizeFiscalCpf('123.456.789-00'), '');
  assert.equal(normalizeFiscalCpf(''), '');
});

test('encontra a linha real de cabeçalho mesmo quando a planilha possui título acima', () => {
  const rows = extractFiscalBankRows([
    ['PROCESSO SELETIVO - 27/09/2026', '', '', ''],
    ['NOME', 'CPF', 'E-MAIL', 'CELULAR'],
    ['Maria da Silva', '116.480.266-64', 'MARIA@EXEMPLO.COM', '(31) 99999-9999'],
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].NOME, 'Maria da Silva');
  assert.equal(rows[0].CPF, '116.480.266-64');
  assert.equal(rows[0]['E-MAIL'], 'MARIA@EXEMPLO.COM');
});

test('dedupe em planilha remove repetição e preserva identidade e CPF correto', () => {
  const rows = [
    { full_name: 'Maria Silva', cpf: '', email: 'maria@empresa.org.br', matricula: '001', institution: 'Faculdade A', role: 'Fiscal de Sala' },
    { full_name: 'Maria Silva', cpf: '116.480.266-64', email: '  maria@empresa.org.br  ', matricula: '002', institution: 'Faculdade B', role: 'Fiscal de Sala' },
    { full_name: 'José', email: 'jose@empresa.org.br', matricula: '010', institution: 'Faculdade A', role: 'Coordenador' },
    { full_name: 'José', email: 'jose@empresa.org.br', matricula: '010', institution: 'Faculdade A', role: 'Coordenador' },
  ];
  const deduped = dedupeFiscalRows(rows);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].cpf, '116.480.266-64');
  assert.equal(deduped[0].sourceKey, deduped[0].sourceKey);
});

test('fingerprint e template são estáveis e idempotentes', () => {
  const a = buildFiscalImportFingerprint({ full_name: 'Ana', email: 'ana@empresa.org.br', institution: 'Faculdade A' });
  const b = buildFiscalImportFingerprint({ full_name: 'Ana', email: 'ana@empresa.org.br', institution: 'Faculdade A' });
  assert.equal(a, b);
  const html = renderFiscalTemplate('Olá, {{nome}}! Evento {{evento}} - {{cargo}} em {{local}}', {
    nome: 'Ana', evento: 'Vestibular', cargo: 'Fiscal de Sala', local: 'Campus I',
  });
  assert.match(html, /Ana/);
  assert.match(html, /Vestibular/);
  assert.doesNotMatch(html, /\{\{.*\}\}/);
});

test('histórico importado do banco central é preservado em campos estruturados e notes fica só observação humana', () => {
  const history = extractFiscalImportedHistory('OBSERVAÇÃO: Acompanhou processos em 2024. [selecao=4] [participacoes=7]');
  assert.equal(history.selection_count, 4);
  assert.equal(history.participation_count, 7);
  assert.match(history.observations, /Acompanhou processos/);

  const merged = mergeFiscalImportedHistory({
    notes: 'Observação geral do fiscal.',
    imported_selection_count: 4,
    imported_participation_count: 7,
    imported_history: { selection_count: 4, participation_count: 7 },
  });

  assert.match(merged.notes, /Observação geral/);
  assert.doesNotMatch(merged.notes, /\[selecao=4\]/i);
  assert.doesNotMatch(merged.notes, /\[participacoes=7\]/i);
  assert.equal(merged.imported_selection_count, 4);
  assert.equal(merged.imported_participation_count, 7);
});
