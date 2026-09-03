import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902490000_security_public_attendance_identity.sql',
    import.meta.url
  ),
  'utf8'
);

const edge = fs.readFileSync(
  new URL(
    '../../supabase/functions/ps-public-signature/index.ts',
    import.meta.url
  ),
  'utf8'
);

const storage = fs.readFileSync(
  new URL('../../src/lib/signatureStorage.ts', import.meta.url),
  'utf8'
);

const page = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx',
    import.meta.url
  ),
  'utf8'
);

test('UUID sozinho não libera mais detalhes de presença', () => {
  assert.match(
    sql,
    /ps_public_get_attendance_details\(uuid\)[\s\S]*FROM PUBLIC,\s*anon,\s*authenticated/i
  );

  assert.match(
    sql,
    /ps_public_get_attendance_details[\s\S]*p_cpf text/i
  );
});

test('alteração pública de PIX e cargo exige CPF', () => {
  assert.match(
    sql,
    /ps_public_confirm_attendance_details[\s\S]*p_cpf text/i
  );

  assert.match(
    sql,
    /ps_public_verify_attendance_identity/i
  );
});

test('tentativas incorretas possuem rate limit persistente', () => {
  assert.match(
    sql,
    /consume_public_api_rate_limit/
  );

  assert.match(
    sql,
    /ps-attendance-identity/
  );
});

test('assinatura normal envia CPF para verificação server-side', () => {
  assert.match(edge, /x-ps-cpf/);
  assert.match(storage, /x-ps-cpf/);
});

test('ausência exige CPF do coordenador responsável', () => {
  assert.match(edge, /x-ps-responsible-cpf/);
  assert.match(storage, /x-ps-responsible-cpf/);
});

test('interface solicita CPF antes de liberar presença', () => {
  assert.match(page, /Confirme seu CPF/);
  assert.match(page, /p_cpf:\s*attendanceCpfDigits/);
  assert.match(page, /CPF do responsável/);
});
