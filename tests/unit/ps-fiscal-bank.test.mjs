import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeFiscalEmail,
  normalizeFiscalMatricula,
  normalizeFiscalInstitution,
  dedupeFiscalRows,
  buildFiscalImportFingerprint,
  renderFiscalTemplate,
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
