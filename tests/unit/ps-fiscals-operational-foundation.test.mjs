import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  normalizeCpf, normalizeEmail, normalizeInstitution, normalizeMatricula,
  planPsFiscalReconciliation, psPresencePatch, resolvePsFiscal,
} from '../../src/lib/psFiscalFoundation.ts';

test('normalização mantém identificadores seguros e normaliza CPF', () => {
  assert.equal(normalizeEmail('  Fiscal+Evento@INSTITUICAO.BR '), 'fiscal+evento@instituicao.br');
  assert.equal(normalizeEmail('  '), null);
  assert.equal(normalizeCpf('125.404.086-21'), '12540408621');
  assert.equal(normalizeCpf('12540408621'), '12540408621');
  assert.equal(normalizeCpf('123'), null);
  assert.equal(normalizeMatricula(' AB-123 '), 'ab-123');
  assert.equal(normalizeInstitution(' Faculdade   Ciências Médicas '), 'faculdade ciências médicas');
});

test('e-mail, CPF e matrícula + instituição reconciliam o cadastro existente', () => {
  const existing = [{ id: 'a', cpf: '125.404.086-21', email: 'fiscal@inst.br', matricula: '10', institution: 'Instituição' }];
  assert.deepEqual(resolvePsFiscal(existing, { email: ' FISCAL@INST.BR ' }), {
    status: 'matched', collaboratorId: 'a', matchedBy: 'email',
  });
  assert.deepEqual(resolvePsFiscal(existing, { cpf: '12540408621' }), {
    status: 'matched', collaboratorId: 'a', matchedBy: 'cpf',
  });
  assert.deepEqual(resolvePsFiscal(existing, { matricula: ' 10 ', institution: ' INSTITUIÇÃO ' }), {
    status: 'matched', collaboratorId: 'a', matchedBy: 'matricula_institution',
  });
});

test('conflito entre identificadores e colisões nunca escolhem pessoas diferentes automaticamente', () => {
  const existing = [
    { id: 'a', cpf: '111.111.111-11', email: 'a@inst.br', matricula: '10', institution: 'Inst' },
    { id: 'b', cpf: '222.222.222-22', email: 'b@inst.br', matricula: '20', institution: 'Inst' },
  ];
  assert.deepEqual(resolvePsFiscal(existing, { email: 'a@inst.br', cpf: '22222222222' }), {
    status: 'ambiguous', matchedBy: 'identity_conflict', candidateIds: ['a', 'b'],
  });
  assert.deepEqual(resolvePsFiscal(existing, { email: 'a@inst.br', matricula: '20', institution: 'Inst' }), {
    status: 'ambiguous', matchedBy: 'identity_conflict', candidateIds: ['a', 'b'],
  });
  assert.equal(resolvePsFiscal([...existing, { id: 'c', email: ' A@INST.BR ' }], { email: 'a@inst.br' }).status, 'ambiguous');
});

test('nome sozinho não faz merge e CPF válido pode identificar cadastro existente ou novo', () => {
  assert.deepEqual(resolvePsFiscal([{ id: 'a' }], { full_name: 'Mesmo Nome' }), {
    status: 'inconsistent', reason: 'missing_identity',
  });
  assert.deepEqual(resolvePsFiscal([], { full_name: 'Pessoa', cpf: '125.404.086-21' }), { status: 'new' });
  assert.deepEqual(resolvePsFiscal([], { full_name: 'Pessoa', email: 'nova@inst.br' }), { status: 'new' });
});

test('duplicidade dentro da planilha reutiliza a nova identidade temporária por e-mail ou CPF', () => {
  const byEmail = planPsFiscalReconciliation([], [
    { full_name: 'Pessoa A', email: 'pessoa@inst.br' },
    { full_name: 'Outro nome', email: ' PESSOA@INST.BR ' },
  ]);
  assert.equal(byEmail[0].status, 'new');
  assert.deepEqual(byEmail[1], { status: 'matched', collaboratorId: '__new_fiscal_0', matchedBy: 'email', rowIndex: 1 });

  const byCpf = planPsFiscalReconciliation([], [
    { full_name: 'Pessoa B', cpf: '125.404.086-21' },
    { full_name: 'Pessoa B repetida', cpf: '12540408621' },
  ]);
  assert.equal(byCpf[0].status, 'new');
  assert.deepEqual(byCpf[1], { status: 'matched', collaboratorId: '__new_fiscal_0', matchedBy: 'cpf', rowIndex: 1 });
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

test('importação mostra preview e concilia CPF sem usar nome como identidade automática', () => {
  const hook = fs.readFileSync(new URL('../../src/hooks/usePsEventTeamImport.ts', import.meta.url), 'utf8');
  const dialog = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventTeamImportDialog.tsx', import.meta.url), 'utf8');
  assert.match(hook, /planPsFiscalReconciliation/);
  assert.match(hook, /id,full_name,cpf,email,email_normalized,matricula,institution/);
  assert.match(hook, /normalizeCpf/);
  assert.match(dialog, /CPF/);
  assert.match(dialog, /Encontrados/);
  assert.match(dialog, /Já vinculados/);
  assert.match(dialog, /Inconsistentes/);
  assert.match(dialog, /Ignorados/);
});
