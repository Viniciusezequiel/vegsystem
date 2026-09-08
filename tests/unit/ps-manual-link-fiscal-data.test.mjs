import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildManualEventCollaboratorRow } from '../../src/lib/psManualEventCollaboratorSnapshot.mjs';

const migrationSql = fs.readFileSync(new URL('../../supabase/migrations/20260908170000_ps_manual_event_collaborator_snapshot_backfill.sql', import.meta.url), 'utf8');

test('manual fiscal link hidrata snapshot do banco do fiscal sem depender de nome', () => {
  const row = buildManualEventCollaboratorRow({
    eventId: 'evt-1',
    collaborator: {
      id: 'collab-1',
      full_name: '  João da Silva  ',
      cpf: ' 123.456.789-00 ',
      identity_doc: ' RG 123 ',
      email: '  joao@empresa.com ',
      phone: ' 11999999999 ',
      mobile: ' 11988888888 ',
      unit: '  Campus Central ',
      sector: ' Recursos Didáticos ',
      institution: '  FELUMA  ',
      pix: ' joao@pix ',
    },
    roleValue: 'coordinator',
    roleName: 'Coordenador',
    payValue: 150,
  });

  assert.equal(row.event_id, 'evt-1');
  assert.equal(row.collaborator_id, 'collab-1');
  assert.equal(row.collaborator_name, 'João da Silva');
  assert.equal(row.email, 'joao@empresa.com');
  assert.equal(row.phone, '11999999999');
  assert.equal(row.mobile, '11988888888');
  assert.equal(row.unit, 'Campus Central');
  assert.equal(row.sector, 'Recursos Didáticos');
  assert.equal(row.institution, 'FELUMA');
  assert.equal(row.cpf, '123.456.789-00');
  assert.equal(row.identity_doc, 'RG 123');
  assert.equal(row.pix, 'joao@pix');
  assert.equal(row.role_value, 'coordinator');
  assert.equal(row.role_name, 'Coordenador');
  assert.equal(row.pay_value, 150);
});

test('migration de backfill usa collaborator_id e apenas preenche campos nulos do snapshot', () => {
  assert.match(migrationSql, /UPDATE public\.ps_event_collaborators/i);
  assert.match(migrationSql, /FROM public\.ps_collaborators/i);
  assert.match(migrationSql, /e\.collaborator_id = c\.id/i);
  assert.match(migrationSql, /COALESCE\(e\.email, c\.email\)/i);
  assert.match(migrationSql, /COALESCE\(e\.phone, c\.phone\)/i);
  assert.match(migrationSql, /COALESCE\(e\.mobile, c\.mobile\)/i);
  assert.match(migrationSql, /COALESCE\(e\.unit, c\.unit\)/i);
  assert.match(migrationSql, /COALESCE\(e\.sector, c\.sector\)/i);
  assert.match(migrationSql, /COALESCE\(e\.institution, c\.institution\)/i);
  assert.match(migrationSql, /COALESCE\(e\.cpf, c\.cpf\)/i);
  assert.match(migrationSql, /COALESCE\(e\.identity_doc, c\.identity_doc\)/i);
  assert.match(migrationSql, /COALESCE\(e\.pix, c\.pix\)/i);
  assert.doesNotMatch(migrationSql, /UPDATE public\.ps_event_collaborators[\s\S]*role_name/i);
  assert.doesNotMatch(migrationSql, /UPDATE public\.ps_event_collaborators[\s\S]*collaborator_name/i);
});
