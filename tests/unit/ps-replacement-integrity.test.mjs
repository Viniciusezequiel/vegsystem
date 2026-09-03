import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902420000_ps_replacement_assignment_integrity.sql',
    import.meta.url
  ),
  'utf8'
);

const eventDetail = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/PsEventDetail.tsx',
    import.meta.url
  ),
  'utf8'
);

test('substituto mantém posto e recebe dados pessoais próprios', () => {
  for (const field of [
    'campus',
    'sector',
    'unit',
    'institution',
    'building',
    'floor',
    'room',
    'work_schedule',
  ]) {
    assert.match(
      sql,
      new RegExp(`p_assignment[\\s\\S]*${field}`)
    );
  }

  for (const field of [
    'cpf',
    'identity_doc',
    'email',
    'phone',
    'mobile',
    'pix',
  ]) {
    assert.match(
      sql,
      new RegExp(
        `v_new_collaborator\\.${field}`
      )
    );
  }
});

test('fiscal confirmado ou substituído não pode voltar para confirmação pendente', () => {
  assert.match(
    sql,
    /v_status\s*=\s*'confirmed'/
  );

  assert.match(
    sql,
    /v_status\s*=\s*'replaced'/
  );

  assert.match(
    sql,
    /collaborator_already_confirmed/
  );

  assert.match(
    sql,
    /replaced_collaborator_cannot_be_reactivated/
  );
});

test('interface usa apenas equipe operacional para responsável de ausência', () => {
  assert.match(
    eventDetail,
    /absenceResponsibleCandidates[\s\S]*return operationalLinks/
  );

  assert.match(
    eventDetail,
    /\['pending_confirmation', 'declined'\]\.includes\(l\.participation_status\)/
  );
});
