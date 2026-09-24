import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const component = fs.readFileSync(
  new URL('../../src/components/processo-seletivo/PsEventTrainingTab.tsx', import.meta.url),
  'utf8'
);

const pdf = fs.readFileSync(
  new URL('../../src/lib/psTrainingAttendancePdf.ts', import.meta.url),
  'utf8'
);

test('cada turma de treinamento pode exportar sua própria lista de presença', () => {
  assert.match(component, /Lista PDF/);
  assert.match(component, /exportSessionAttendance/);
  assert.match(component, /training_session_id === session\.id/);
  assert.match(component, /generatePsTrainingAttendancePdf/);
});

test('treinamentos e datas podem ser editados depois do cadastro', () => {
  assert.match(component, /Editar treinamento/);
  assert.match(component, /editingGroupId/);
  assert.match(component, /Treinamento atualizado/);
  assert.match(component, /Editar data de treinamento/);
  assert.match(component, /editingSessionId/);
  assert.match(component, /Data de treinamento atualizada/);
});

test('exportação usa escolhas registradas e cargos reais do colaborador', () => {
  assert.match(component, /ps_event_training_choices/);
  assert.match(component, /ps_event_collaborator_assignments/);
  assert.match(component, /event_collaborator_id/);
  assert.match(component, /role_name/);
});

test('PDF possui identificação do treinamento e espaço para assinatura manual', () => {
  assert.match(pdf, /LISTA DE PRESENÇA - TREINAMENTO/);
  assert.match(pdf, /NOME COMPLETO/);
  assert.match(pdf, /CARGO\(S\)/);
  assert.match(pdf, /ASSINATURA/);
  assert.match(pdf, /Participantes inscritos nesta turma/);
  assert.match(pdf, /LOCAL DO TREINAMENTO/);
  assert.doesNotMatch(pdf, /session\.location \|\| event\.location/);
  assert.match(pdf, /session\.campus,[\s\S]*session\.location,[\s\S]*session\.room/);
  assert.doesNotMatch(pdf, /`Sala \$\{session\.room\}`/);
});

test('lista é ordenada alfabeticamente e paginada', () => {
  assert.match(pdf, /localeCompare/);
  assert.match(pdf, /doc\.addPage/);
  assert.match(pdf, /getNumberOfPages/);
});

test('gestão do treinamento permite localizar e remanejar qualquer pessoa', () => {
  assert.match(component, /Buscar pessoa que já possui treinamento definido/);
  assert.match(component, /normalize\('NFD'\)/);
  assert.match(component, /matchingSessionIds/);
  assert.match(component, /matchingGroupIds/);
  assert.match(component, /Ver todos \(\{choices\.length\}\)/);
  assert.match(component, /openSessionParticipants/);
  assert.match(component, /Pesquisar nome dentro desta data/);
  assert.match(component, /Remanejar/);
  assert.match(component, /openParticipantFromList/);
});
