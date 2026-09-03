import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('formulário público envia PNG ao backend intermediário e nunca chama RPC com Base64', () => {
  const page = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx', import.meta.url), 'utf8');
  const helper = fs.readFileSync(new URL('../../src/lib/signatureStorage.ts', import.meta.url), 'utf8');
  assert.match(page, /submitPublicProcessSelectionSignature\(selected\.id, signature\)/);
  assert.doesNotMatch(page, /rpc\('ps_public_sign_attendance'/);
  assert.match(helper, /functions\/v1\/ps-public-signature/);
  assert.match(helper, /'content-type': 'image\/png'/);
  assert.match(helper, /png\.size > 512 \* 1024/);
});

test('Edge Function valida participante, confirma banco e limpa somente sem referência', () => {
  const edge = fs.readFileSync(new URL('../../supabase/functions/ps-public-signature/index.ts', import.meta.url), 'utf8');
  assert.match(edge, /ps_events!inner\(hidden_from_evaluation\)/);
  assert.match(edge, /\.is\('signed_at', null\)/);
  assert.match(edge, /attendance_pix_confirmed_at/);
  assert.match(edge, /attendance_details_not_confirmed/);
  assert.match(edge, /\.in\('participation_status'/);
  assert.match(edge, /bytes\.length > 512 \* 1024/);
  assert.match(edge, /pngMagic\.every/);
  assert.match(edge, /rpc\('ps_public_sign_attendance'/);
  assert.match(edge, /\.eq\('signature_url', locator\)/);
  assert.match(edge, /if \(\(count \?\? 0\) === 0\)/);
  assert.doesNotMatch(edge, /capability|service_role\s*[:=]/i);
});

test('RPC aceita somente locator canônico de process-selection e não aceita Base64', () => {
  const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901193000_ps_public_attendance_r2.sql', import.meta.url), 'utf8');
  assert.match(sql, /r2\/signatures\/process-selection/);
  assert.match(sql, /REVOKE ALL[\s\S]*FROM anon/);
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.doesNotMatch(sql, /data:image|GRANT EXECUTE[\s\S]*TO anon/);
});

test('PDF resolve R2 somente na operação assíncrona', () => {
  const pdf = fs.readFileSync(new URL('../../src/lib/psEventPdf.ts', import.meta.url), 'utf8');
  assert.match(pdf, /generatePsAttendancePdfAsync/);
  assert.match(pdf, /preparePdfSignatureRows\(rows, resolveR2Signature\)/);
});


test('presença pública bloqueia recusados e substituídos também no banco', () => {
  const sql = fs.readFileSync(
    new URL(
      '../../supabase/migrations/20260902370000_ps_attendance_active_participants_only.sql',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(
    sql,
    /participation_status\s+IN\s*\([\s\S]*?'pending_confirmation'[\s\S]*?'confirmed'/i
  );

  assert.match(
    sql,
    /ps_public_sign_attendance/
  );

  assert.match(
    sql,
    /ps_public_get_attendance_details/
  );

  assert.match(
    sql,
    /ps_public_confirm_attendance_details/
  );
});
