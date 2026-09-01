import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { REALISTIC_PS_CLIENTS } from '../e2e/helpers/ps-realtime-harness.mjs';

const hook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');
const attendance = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx', import.meta.url), 'utf8');
const evaluation = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicEvaluation.tsx', import.meta.url), 'utf8');
const eventDetail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const sql = fs.readFileSync(new URL('../../supabase/migrations/20260901230000_ps_realtime_operations.sql', import.meta.url), 'utf8');

test('listagem interna é leve e recebe mudanças Realtime do evento atual', () => {
  const projection = hook.match(/const PS_EVENT_COLLABORATOR_LIST_SELECT = \[([\s\S]*?)\]\.join/)?.[1] || '';
  assert.doesNotMatch(projection, /signature_url/);
  assert.match(hook, /table: 'ps_event_collaborators', filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(hook, /table: 'ps_evaluations'/);
});

test('busca pública é limitada ao evento, leve e cobre nome, matrícula e e-mail', () => {
  assert.match(sql, /WHERE ec\.event_id = p_event_id/);
  assert.match(sql, /collaborator_name ILIKE[\s\S]*matricula ILIKE[\s\S]*email ILIKE/);
  assert.match(sql, /LIMIT 50/);
  assert.doesNotMatch(sql.match(/CREATE OR REPLACE FUNCTION public\.ps_public_search_event_roster[\s\S]*?\$\$;/)?.[0] || '', /signature_url/);
  assert.match(attendance, /ps_public_search_event_roster/);
  assert.match(evaluation, /ps_public_search_event_roster/);
  assert.match(attendance, /refetchInterval: 3_000/);
});

test('concorrência de presença usa versão esperada e rejeita estado contraditório', () => {
  assert.match(sql, /ec\.updated_at = p_expected_updated_at/);
  assert.match(sql, /IF p_present AND p_absent/);
  assert.match(sql, /RETURN QUERY SELECT false, true/);
  assert.match(hook, /ps_set_event_participant_state/);
  assert.match(eventDetail, /alterado em outro dispositivo|setParticipantState/);
});

test('assinatura dupla permanece condicionada e avaliações não duplicam por evento', () => {
  const signatureSql = fs.readFileSync(new URL('../../supabase/migrations/20260901193000_ps_public_attendance_r2.sql', import.meta.url), 'utf8');
  assert.match(signatureSql, /ec\.signed_at IS NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluations_event_collaborator_unique/);
  assert.match(sql, /\(event_id, collaborator_id\)/);
});

test('não existe limite artificial de tablets e UX evita assinatura repetida', () => {
  assert.equal(REALISTIC_PS_CLIENTS, 10);
  assert.doesNotMatch(`${hook}\n${attendance}\n${evaluation}\n${sql}`, /MAX_(CLIENTS|SESSIONS)|device_limit|tablet_limit|sessions\s*[<>=]+\s*10/i);
  assert.match(attendance, /disabled=\{!!l\.signed_at\}/);
  assert.match(attendance, /min-h-14/);
  assert.match(attendance, /Registrando\.\.\./);
});

test('páginas públicas e dados do evento usam subscriptions por event_id sem fanout global', () => {
  assert.match(hook, /table: 'ps_events', [\s\S]*filter: `id=eq\.\$\{id\}`/);
  assert.match(hook, /table: 'ps_candidates', [\s\S]*filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(hook, /table: 'ps_self_evaluations', [\s\S]*filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(attendance, /postgres_changes[\s\S]*ps_event_collaborators[\s\S]*event_id=eq\.\$\{eventId\}/);
  assert.match(attendance, /postgres_changes[\s\S]*ps_events[\s\S]*id=eq\.\$\{eventId\}/);
  assert.match(evaluation, /postgres_changes[\s\S]*ps_event_collaborators[\s\S]*event_id=eq\.\$\{eventId\}/);
  assert.doesNotMatch(`${hook}\n${attendance}\n${evaluation}`, /channel\(['\"]realtime-multi|channel\(['\"][^\n]*all[^\n]*\)|schema: 'public', table: 'ps_events'[^\n]*\}/);
});
