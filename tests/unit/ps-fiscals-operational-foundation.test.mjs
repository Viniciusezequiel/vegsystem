import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  normalizeEmail, normalizeInstitution, normalizeMatricula,
  planPsFiscalReconciliation, psPresencePatch, resolvePsFiscal,
} from '../../src/lib/psFiscalFoundation.ts';

test('normalização é conservadora e não exige CPF', () => {
  assert.equal(normalizeEmail('  Fiscal+Evento@INSTITUICAO.BR '), 'fiscal+evento@instituicao.br');
  assert.equal(normalizeEmail('  '), null);
  assert.equal(normalizeMatricula(' AB-123 '), 'ab-123');
  assert.equal(normalizeInstitution(' Faculdade   Ciências Médicas '), 'faculdade ciências médicas');
});

test('e-mail tem prioridade e fallback exige matrícula + instituição', () => {
  const existing = [{ id: 'a', email: 'fiscal@inst.br', matricula: '10', institution: 'Instituição' }];
  assert.deepEqual(resolvePsFiscal(existing, { email: ' FISCAL@INST.BR ' }), {
    status: 'matched', collaboratorId: 'a', matchedBy: 'email',
  });
  assert.deepEqual(resolvePsFiscal(existing, { matricula: ' 10 ', institution: ' INSTITUIÇÃO ' }), {
    status: 'matched', collaboratorId: 'a', matchedBy: 'matricula_institution',
  });
});

test('conflito entre identificadores e colisões nunca escolhem automaticamente', () => {
  const existing = [
    { id: 'a', email: 'a@inst.br', matricula: '10', institution: 'Inst' },
    { id: 'b', email: 'b@inst.br', matricula: '20', institution: 'Inst' },
  ];
  assert.deepEqual(resolvePsFiscal(existing, { email: 'a@inst.br', matricula: '20', institution: 'Inst' }), {
    status: 'ambiguous', matchedBy: 'identity_conflict', candidateIds: ['a', 'b'],
  });
  assert.equal(resolvePsFiscal([...existing, { id: 'c', email: ' A@INST.BR ' }], { email: 'a@inst.br' }).status, 'ambiguous');
});

test('nome e CPF sozinhos nunca fazem merge nem criam pessoa automaticamente', () => {
  assert.deepEqual(resolvePsFiscal([{ id: 'a' }], { full_name: 'Mesmo Nome' }), {
    status: 'inconsistent', reason: 'missing_identity',
  });
  assert.deepEqual(resolvePsFiscal([], { full_name: 'Pessoa', email: 'nova@inst.br' }), { status: 'new' });
});

test('duplicidade dentro da planilha reutiliza a nova identidade temporária', () => {
  const decisions = planPsFiscalReconciliation([], [
    { full_name: 'Pessoa A', email: 'pessoa@inst.br' },
    { full_name: 'Outro nome', email: ' PESSOA@INST.BR ' },
  ]);
  assert.equal(decisions[0].status, 'new');
  assert.deepEqual(decisions[1], { status: 'matched', collaboratorId: '__new_fiscal_0', matchedBy: 'email', rowIndex: 1 });
});

test('presença administrativa nunca produz true/true', () => {
  assert.deepEqual(psPresencePatch('present', true), { present: true, absent: false });
  assert.deepEqual(psPresencePatch('absent', true), { absent: true, present: false });
});

test('migration é incremental, preserva RLS e exige identidade/vínculo consistentes', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901213000_ps_fiscals_operational_foundation.sql', import.meta.url), 'utf8');
  assert.match(sql, /email_normalized text[\s\S]*NULLIF\(lower\(trim\(email\)\), ''\)/);
  assert.match(sql, /ps_collaborators_email_normalized_unique/);
  assert.match(sql, /ps_collaborators_matricula_institution_unique/);
  assert.match(sql, /CHECK \(NOT \(present AND absent\)\) NOT VALID/);
  assert.match(sql, /CHECK \(collaborator_id IS NOT NULL\) NOT VALID/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|TRUNCATE|cpf_normalized|ALTER POLICY|DROP POLICY/i);
});

test('importação mostra preview e não concilia por CPF/nome', () => {
  const hook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');
  const dialog = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventTeamImportDialog.tsx', import.meta.url), 'utf8');
  assert.match(hook, /planPsFiscalReconciliation/);
  assert.doesNotMatch(hook, /byCpf|byName|normalizeCpf/);
  assert.match(dialog, /Encontrados/);
  assert.match(dialog, /Já vinculados/);
  assert.match(dialog, /Inconsistentes/);
  assert.match(dialog, /Ignorados/);
});
