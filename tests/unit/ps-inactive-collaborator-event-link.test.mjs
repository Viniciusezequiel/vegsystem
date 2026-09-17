import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const importHook = fs.readFileSync(new URL('../../src/hooks/usePsEventTeamImport.ts', import.meta.url), 'utf8');
const importDialog = fs.readFileSync(new URL('../../src/components/processo-seletivo/PsEventTeamImportDialog.tsx', import.meta.url), 'utf8');
const eventDetail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../supabase/migrations/20260917210432_block_inactive_ps_collaborator_event_links.sql', import.meta.url), 'utf8');

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
