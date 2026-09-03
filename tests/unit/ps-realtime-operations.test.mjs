import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { REALISTIC_PS_CLIENTS } from '../e2e/helpers/ps-realtime-harness.mjs';

const hook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');
const attendance = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx', import.meta.url), 'utf8');
const evaluation = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicEvaluation.tsx', import.meta.url), 'utf8');
const eventDetail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const historicalSql = fs.readFileSync(new URL('../../supabase/migrations/20260901230000_ps_realtime_operations.sql', import.meta.url), 'utf8');
const finalRosterSql = fs.readFileSync(new URL('../../supabase/migrations/20260902360000_ps_public_roster_full_list.sql', import.meta.url), 'utf8');
const broadcastSql = fs.readFileSync(new URL('../../supabase/migrations/20260902030000_ps_public_realtime_broadcast.sql', import.meta.url), 'utf8');

test('listagem interna é leve e recebe mudanças Realtime do evento atual', () => {
  const projection = hook.match(/const PS_EVENT_COLLABORATOR_LIST_SELECT = \[([\s\S]*?)\]\.join/)?.[1] || '';
  assert.doesNotMatch(projection, /signature_url/);
  assert.match(hook, /table: 'ps_event_collaborators', filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(hook, /table: 'ps_evaluations'/);
});

test('busca pública atual aceita vazio, NULL e 1 caractere, sempre dentro do evento', () => {
  assert.match(finalRosterSql, /WHERE ec\.event_id = p_event_id/);
  assert.match(finalRosterSql, /LIMIT\s+1000/i);
  assert.match(
    finalRosterSql,
    /participation_status\s+IN\s*\([\s\S]*pending_confirmation[\s\S]*confirmed/i
  );
  assert.doesNotMatch(
    finalRosterSql.match(
      /CREATE OR REPLACE FUNCTION public\.ps_public_search_event_roster[\s\S]*?\$\$;/
    )?.[0] || '',
    /participation_status\s+IN[\s\S]*declined|participation_status\s+IN[\s\S]*replaced/i
  );
  assert.match(finalRosterSql, /trim\(coalesce\(p_search, ''\)\) = ''/);
  assert.doesNotMatch(finalRosterSql, /length\(trim\(coalesce\(p_search, ''\)\)\)\s*>=\s*2/);
  assert.match(
    finalRosterSql,
    /ec\.collaborator_name[\s\S]*?ILIKE[\s\S]*?trim\(p_search\)/
  );
  assert.match(
    finalRosterSql,
    /ec\.role_name[\s\S]*?ILIKE[\s\S]*?trim\(p_search\)/
  );
  assert.match(
    finalRosterSql,
    /ec\.assigned_role[\s\S]*?ILIKE[\s\S]*?trim\(p_search\)/
  );
  assert.doesNotMatch(finalRosterSql.match(/CREATE OR REPLACE FUNCTION public\.ps_public_search_event_roster[\s\S]*?\$\$;/)?.[0] || '', /signature_url/);
  assert.match(attendance, /ps_public_search_event_roster/);
  assert.match(evaluation, /\/ps\/avaliador/);
  assert.doesNotMatch(evaluation, /ps_public_submit_evaluation/);
  assert.doesNotMatch(attendance, /refetchInterval:\s*3_000/);
  assert.doesNotMatch(historicalSql, /trim\(coalesce\(p_search, ''\)\) = ''/);
});

test('concorrência de presença usa versão esperada e rejeita estado contraditório', () => {
  assert.match(historicalSql, /ec\.updated_at = p_expected_updated_at/);
  assert.match(historicalSql, /IF p_present AND p_absent/);
  assert.match(historicalSql, /RETURN QUERY SELECT false, true/);
  assert.match(hook, /ps_set_event_participant_state/);
  assert.match(eventDetail, /alterado em outro dispositivo|setParticipantState/);
});

test('assinatura dupla permanece condicionada e avaliações não duplicam por evento', () => {
  const signatureSql = fs.readFileSync(new URL('../../supabase/migrations/20260901193000_ps_public_attendance_r2.sql', import.meta.url), 'utf8');
  assert.match(signatureSql, /ec\.signed_at IS NULL/);
  assert.match(historicalSql, /CREATE UNIQUE INDEX IF NOT EXISTS ps_evaluations_event_collaborator_unique/);
  assert.match(historicalSql, /\(event_id, collaborator_id\)/);
});

test('não existe limite artificial de tablets e UX evita assinatura repetida', () => {
  assert.equal(REALISTIC_PS_CLIENTS, 10);
  assert.doesNotMatch(`${hook}\n${attendance}\n${evaluation}\n${historicalSql}\n${finalRosterSql}\n${broadcastSql}`, /MAX_(CLIENTS|SESSIONS)|device_limit|tablet_limit|sessions\s*[<>=]+\s*10/i);
  assert.match(
    attendance,
    /disabled=\{\s*isAlreadySigned\s*\|\|\s*isAbsent\s*\|\|\s*isSavingSignature\s*\}/
  );
  assert.match(attendance, /min-h-(14|16)/);
  assert.match(attendance, /Registrando\s+presença|Registrando\s+\./);
});

test('páginas públicas e dados do evento usam broadcast por event_id sem fanout global', () => {
  assert.match(hook, /table: 'ps_events', [\s\S]*filter: `id=eq\.\$\{id\}`/);
  assert.match(hook, /table: 'ps_candidates', [\s\S]*filter: `event_id=eq\.\$\{eventId\}`/);
  assert.match(hook, /table: 'ps_self_evaluations'[^]*event_id=eq\.\$\{eventId\}/);
  assert.match(attendance, /channel\(`ps:event:\$\{eventId\}`\)|channel\("ps:event:\$\{eventId\}"\)/);
  assert.match(attendance, /on\('broadcast', \{ event: 'roster_changed' \}/);
  assert.match(attendance, /ps_public_search_event_roster/);
  assert.doesNotMatch(`${attendance}\n${evaluation}`, /postgres_changes[\s\S]*ps_event_collaborators[\s\S]*event_id=eq\.\$\{eventId\}/);
  assert.doesNotMatch(`${attendance}\n${evaluation}`, /from\('ps_event_collaborators'\)|from\("ps_event_collaborators"\)|table: 'ps_event_collaborators'/);
  assert.doesNotMatch(`${hook}\n${attendance}\n${evaluation}`, /channel\(['\"]realtime-multi|channel\(['\"][^\n]*all[^\n]*\)/);
  assert.match(broadcastSql, /'ps:event:'\s*\|\|\s*p_event_id/);
  assert.match(broadcastSql, /roster_changed/);
  assert.match(broadcastSql, /AFTER INSERT OR UPDATE OF .* OR DELETE/);
  assert.match(broadcastSql, /NEW\.event_id|OLD\.event_id/);
  assert.match(broadcastSql, /resource.*event_collaborators|action.*changed/);
});
