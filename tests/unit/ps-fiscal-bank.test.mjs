import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFiscalEmail,
  normalizeFiscalMatricula,
  normalizeFiscalInstitution,
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

test('dedupe em planilha remove repetição e preserva identidade correta', () => {
  const rows = [
    { full_name: 'Maria Silva', email: 'maria@empresa.org.br', matricula: '001', institution: 'Faculdade A', role: 'Fiscal de Sala' },
    { full_name: 'Maria Silva', email: '  maria@empresa.org.br  ', matricula: '002', institution: 'Faculdade B', role: 'Fiscal de Sala' },
    { full_name: 'José', email: 'jose@empresa.org.br', matricula: '010', institution: 'Faculdade A', role: 'Coordenador' },
    { full_name: 'José', email: 'jose@empresa.org.br', matricula: '010', institution: 'Faculdade A', role: 'Coordenador' },
  ];
  const deduped = dedupeFiscalRows(rows);
  assert.equal(deduped.length, 2);
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
