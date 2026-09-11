import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('perfil interno exibe CPF formatado', () => {
  const source = read('src/pages/processo-seletivo/PsCollaborators.tsx');
  assert.match(source, /formatFiscalCpf\(profileFiscal\.cpf\)/);
  assert.match(source, />CPF:<\/strong>/);
});

test('assinatura pública exibe somente CPF mascarado', () => {
  const page = read('src/pages/processo-seletivo/public/PsPublicAttendance.tsx');
  const storage = read('src/lib/signatureStorage.ts');
  const edge = read('supabase/functions/ps-public-signature/index.ts');

  assert.match(page, /attendanceDetails\.cpf_masked/);
  assert.match(page, /Confirmo que meu CPF, meu cargo e minha chave PIX/);
  assert.match(storage, /cpf_masked: string \| null/);
  assert.match(edge, /from\('ps_collaborators'\)[\s\S]*select\('cpf'\)/);
  assert.match(edge, /cpf_masked: cpfMasked/);
  assert.match(edge, /\*\*\*\.\*\*\*\./);
});

test('validação pública prioriza o CPF do cadastro mestre', () => {
  const migration = read('supabase/migrations/20260911123000_ps_cpf_canonical_usage.sql');
  const masterPosition = migration.indexOf("nullif(trim(c.cpf), '')");
  const linkPosition = migration.indexOf("nullif(trim(ec.cpf), '')");

  assert.ok(masterPosition >= 0);
  assert.ok(linkPosition > masterPosition);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.ps_sync_evaluator_account_cpfs/);
});
