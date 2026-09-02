import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  canTransitionPsConfirmation, getPsConfirmationSummary, replacementAssignment,
} from '../../src/lib/psConfirmationState.mjs';
import { buildPsConfirmationNotice, createPsConfirmationDeliveryRequest } from '../../src/lib/psConfirmationNotice.mjs';

const sql = fs.readFileSync(new URL('../../supabase/migrations/20260902050000_ps_confirmation_flow_base.sql', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicConfirmation.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');

test('status possuem transições explícitas e replaced é terminal', () => {
  assert.equal(canTransitionPsConfirmation('pending_confirmation', 'confirmed'), true);
  assert.equal(canTransitionPsConfirmation('pending_confirmation', 'declined'), true);
  assert.equal(canTransitionPsConfirmation('declined', 'pending_confirmation'), true);
  assert.equal(canTransitionPsConfirmation('replaced', 'confirmed'), false);
  assert.deepEqual(getPsConfirmationSummary([{ participation_status: 'confirmed' }, { participation_status: 'declined' }]), {
    pending_confirmation: 0, confirmed: 1, declined: 1, replaced: 0,
  });
});

test('token público é opaco, hasheado em repouso, expira, revoga e é de uso único', () => {
  assert.match(sql, /gen_random_bytes\(32\)/);
  assert.match(sql, /digest\(v_token, 'sha256'\)/);
  assert.match(sql, /public_confirmation_token_hash/);
  assert.doesNotMatch(sql, /ADD COLUMN IF NOT EXISTS public_confirmation_token text/);
  assert.match(sql, /public_confirmation_token_expires_at > now\(\)/);
  assert.match(sql, /public_confirmation_token_revoked_at IS NULL/);
  assert.match(sql, /THEN 'expired'/);
  assert.match(sql, /THEN 'used'/);
  assert.match(sql, /ps_event_collaborators\.participation_status='pending_confirmation'/);
  assert.match(sql, /participation_status=p_status/);
  assert.match(page, /ps_public_get_event_collaborator_confirmation/);
  assert.match(page, /ps_public_set_event_collaborator_confirmation/);
});

test('recusa exige motivo e não é confundida com presença', () => {
  assert.match(sql, /decline_reason_required/);
  const confirmationFunctions = sql.match(/ps_public_set_event_collaborator_confirmation[\s\S]*?REVOKE ALL/)?.[0] || '';
  assert.doesNotMatch(confirmationFunctions, /\bpresent\b|\babsent\b/);
});

test('substituição herda alocação, bloqueia duplicidade e preserva cadeia', () => {
  const inherited = replacementAssignment({ role_name: 'Fiscal', unit: 'Centro', floor: '2', room: '10', work_schedule: '08:00' });
  assert.equal(inherited.role_name, 'Fiscal'); assert.equal(inherited.room, '10');
  assert.match(sql, /collaborator_already_linked/);
  assert.match(sql, /coalesce\(v_old\.original_event_collaborator_id,v_old\.id\)/);
  assert.match(sql, /replacement_for_event_collaborator_id/);
  assert.match(sql, /participation_status='replaced'/);
  assert.match(detail, /Substituir fiscal/);
});

test('Realtime existente cobre alterações da confirmação no vínculo do evento', () => {
  const hook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');
  assert.match(hook, /table: 'ps_event_collaborators', filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(hook, /ps_event_confirmation_summary/);
  assert.match(sql, /ps_event_collaborators_confirmation_broadcast/);
  assert.match(sql, /AFTER UPDATE OF participation_status/);
});

test('contrato de aviso não realiza envio real', () => {
  const notice = buildPsConfirmationNotice({ collaboratorName: 'Fiscal', eventName: 'Evento', confirmationUrl: 'https://example.test/token', expiresAt: 'amanhã' });
  const request = createPsConfirmationDeliveryRequest({ recipient: 'fiscal@example.test', notice });
  assert.equal(request.dispatch, false); assert.match(notice.text, /example\.test\/token/);
});
