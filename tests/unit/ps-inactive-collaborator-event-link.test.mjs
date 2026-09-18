import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const importHook = fs.readFileSync(new URL('../../src/hooks/usePsEventTeamImport.ts', import.meta.url), 'utf8');
const importDialog = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventTeamImportDialog.tsx', import.meta.url), 'utf8');
const eventDetail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260917210432_block_inactive_ps_collaborator_event_links.sql', import.meta.url), 'utf8');
const historyMigration = fs.readFileSync(new URL('../../supabase/migrations/20260918130000_ps_collaborator_inactivation_history.sql', import.meta.url), 'utf8');
const collaboratorPage = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsCollaborators.tsx', import.meta.url), 'utf8');
const collaboratorHook = fs.readFileSync(new URL('../../src/hooks/useProcessoSeletivo.ts', import.meta.url), 'utf8');

test('event import identifies, displays and skips inactive collaborators without blocking valid rows', () => {
  assert.match(importHook, /email_normalized,matricula,institution,active/);
  assert.match(importHook, /matchedCollaborator\?\.active === false/);
  assert.match(importHook, /if \(inactiveRows\.has\(decision\.rowIndex\)\) continue/);
  assert.match(importHook, /inactiveSkipped: inactiveRows\.size/);
  assert.match(importDialog, /Estes colaboradores estão inativos e não entrarão no evento/);
  assert.match(importDialog, /Inativos ignorados/);
  assert.match(importDialog, /preview\.length - plan\.inactiveCount/);
  assert.doesNotMatch(importDialog, /plan\.inactiveCount > 0/);
});

test('event import only previews selected rows when the spreadsheet has selection status', () => {
  assert.match(importDialog, /STATUS DE SELEÇÃO/);
  assert.match(importDialog, /SELECTED_STATUSES/);
  assert.match(importDialog, /sim.*selecionado.*selecionada.*selecionado a/);
  assert.match(importDialog, /excludedBySelection/);
  assert.match(importDialog, /não selecionado\(s\) ignorado\(s\)/);
});

test('manual event linking revalidates active collaborators before writing', () => {
  assert.match(eventDetail, /\.in\('id', selected\)/);
  assert.match(eventDetail, /\.eq\('active', true\)/);
  assert.match(eventDetail, /foram inativados e não podem ser vinculados ao evento/);
});

test('database rejects a new event link for an inactive collaborator', () => {
  assert.match(migration, /BEFORE INSERT OR UPDATE OF collaborator_id/);
  assert.match(migration, /collaborator\.active = true/);
  assert.match(migration, /ERRCODE = '23514'/);
  assert.match(migration, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon, authenticated/);
});

test('inativação exige motivo e registra responsável em histórico protegido', () => {
  assert.match(historyMigration, /ps_collaborator_status_history/);
  assert.match(historyMigration, /enable row level security/i);
  assert.match(historyMigration, /p_reason_category not in/);
  assert.match(historyMigration, /inactivated_by_name/);
  assert.match(historyMigration, /public\.is_internal_user\(auth\.uid\(\)\)/);
  assert.match(historyMigration, /revoke all on function public\.ps_set_collaborator_active[\s\S]*from public, anon, authenticated/i);
  assert.match(collaboratorPage, /Confirmar inativação/);
  assert.match(collaboratorPage, /Atestado ou afastamento/);
  assert.match(collaboratorHook, /rpc\('ps_set_collaborator_active'/);
});

test('vínculos inativos antigos ficam auditáveis e fora dos fluxos operacionais', () => {
  assert.match(eventDetail, /const inactiveEventLinks = useMemo/);
  assert.match(eventDetail, /const links = useMemo\([\s\S]*active !== false/);
  assert.match(eventDetail, /não entram nas contagens, comunicações, presença, pagamentos ou avaliações/);
  assert.match(eventDetail, /Substituir fiscal/);
  assert.match(eventDetail, /Remover vínculo/);
});
