import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const classroomHooks = fs.readFileSync(new URL('../../src/hooks/useClassroomCalls.ts', import.meta.url), 'utf8');
const realtime = fs.readFileSync(new URL('../../src/hooks/useRealtimeSubscription.ts', import.meta.url), 'utf8');
const publicCall = fs.readFileSync(new URL('../../src/pages/classroom/ClassroomCallForm.tsx', import.meta.url), 'utf8');
const permissions = fs.readFileSync(new URL('../../src/hooks/usePermissions.ts', import.meta.url), 'utf8');
const lostItems = fs.readFileSync(new URL('../../src/hooks/useLostItems.ts', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../../src/pages/DashboardStats.tsx', import.meta.url), 'utf8');
const processoSeletivo = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');

test('chamados internos usam Realtime sem polling continuo de contagem', () => {
  assert.match(realtime, /classroom_calls:\s*\['classroom-calls', 'pending-calls-count'\]/);
  assert.doesNotMatch(classroomHooks, /refetchInterval:\s*20_000/);
  assert.doesNotMatch(classroomHooks, /pending-calls-count-\$\{/);
  assert.doesNotMatch(classroomHooks, /classroom-calls-changes-\$\{/);
  assert.match(classroomHooks, /refetchOnWindowFocus:\s*false/);
});

test('acompanhamento publico reduz polling, pausa em aba oculta e encerra ao resolver', () => {
  assert.match(publicCall, /PUBLIC_STATUS_POLL_MS\s*=\s*10_000/);
  assert.match(publicCall, /document\.visibilityState\s*!==\s*'visible'/);
  assert.match(publicCall, /callStatus\?\.status === 'resolved'/);
  assert.match(publicCall, /visibilitychange/);
  assert.doesNotMatch(publicCall, /setInterval\(fetchStatus,\s*2500\)/);
});

test('consultas frequentes usam cache/realtime para reduzir egress', () => {
  assert.match(permissions, /staleTime:\s*10 \* 60 \* 1000/);
  assert.match(lostItems, /staleTime:\s*5 \* 60 \* 1000/);
  assert.match(realtime, /'dashboard-lost-items-timeline'/);
});

test('dashboard nao baixa ate 2000 registros completos de achados para o grafico', () => {
  assert.match(dashboard, /select\('id,received_date,created_at'/);
  assert.match(dashboard, /dashboard-lost-items-timeline/);
  assert.doesNotMatch(dashboard, /pageSize:\s*2000/);
});


test('processo seletivo evita refetch repetitivo de listas grandes cobertas por Realtime', () => {
  const collaboratorBlock = processoSeletivo.match(/export function usePsEventCollaborators[\s\S]*?return query;/)?.[0] || '';
  const communicationBlock = processoSeletivo.match(/export function usePsEventCommunications[\s\S]*?return query;/)?.[0] || '';
  const candidateBlock = processoSeletivo.match(/export function usePsCandidates[\s\S]*?return query;/)?.[0] || '';
  assert.match(collaboratorBlock, /staleTime:\s*5 \* 60 \* 1000/);
  assert.match(communicationBlock, /staleTime:\s*5 \* 60 \* 1000/);
  assert.match(candidateBlock, /staleTime:\s*5 \* 60 \* 1000/);
  assert.match(collaboratorBlock, /postgres_changes/);
  assert.match(communicationBlock, /communications_changed/);
  assert.match(candidateBlock, /postgres_changes/);
  assert.match(collaboratorBlock, /scheduleRefresh/);
  assert.match(collaboratorBlock, /setTimeout\(\(\) => \{/);
  assert.match(collaboratorBlock, /500/);
});
