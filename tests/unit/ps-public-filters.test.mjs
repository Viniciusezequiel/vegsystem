import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  isSelfEvaluationEnabled,
  filterPublicRoster,
} from '../../src/lib/psPublicFilters.mjs';

const evaluationSource = fs.readFileSync(new URL('../../src/pages/processo-seletivo/public/PsPublicEvaluation.tsx', import.meta.url), 'utf8');

test('autoavaliação só aparece quando o evento foi explicitamente habilitado e não está fechado', () => {
  assert.equal(isSelfEvaluationEnabled({ self_evaluation_enabled: true, status: 'em_andamento' }), true);
  assert.equal(isSelfEvaluationEnabled({ self_evaluation_enabled: true, status: 'finalizado' }), false);
  assert.equal(isSelfEvaluationEnabled({ hidden_from_evaluation: false }), false);
  assert.equal(isSelfEvaluationEnabled({}), false);
});

test('lista pública mostra todos os fiscais por default e filtra em tempo real pelo texto', () => {
  const rows = [
    { id: '1', collaborator_name: 'Ana Silva', role_name: 'Fiscal de Sala', email: 'ana@empresa.com', unit: 'Unidade Central', room: 'Sala 101' },
    { id: '2', collaborator_name: 'Bruno Costa', role_name: 'Coordenador', email: 'bruno@empresa.com', unit: 'Complexo Norte', room: 'Sala 220' },
    { id: '3', collaborator_name: 'Carla Dias', role_name: 'Fiscal de Sala', email: 'carla@empresa.com', unit: 'Unidade Sul', room: 'Sala 301' },
  ];

  assert.equal(filterPublicRoster(rows, '').length, 3);
  assert.equal(filterPublicRoster(rows, null).length, 3);
  assert.equal(filterPublicRoster(rows, '   ').length, 3);
  assert.deepEqual(filterPublicRoster(rows, 'ana').map((row) => row.id), ['1']);
  assert.deepEqual(filterPublicRoster(rows, 'coorden').map((row) => row.id), ['2']);
  assert.deepEqual(filterPublicRoster(rows, 'sala 301').map((row) => row.id), ['3']);
});

test('avaliação pública usa lista visível com busca opcional e sem campo redundante de “fiscal avaliado”', () => {
  assert.match(evaluationSource, /listar|fiscais\)|onClick=\{\(\) => setCollaboratorId\(l.id\)\}/);
  assert.doesNotMatch(evaluationSource, /<Label>Fiscal avaliado<\/Label>/);
  assert.doesNotMatch(evaluationSource, /<Select value=\{collaboratorId\}/);
});

test('detalhe do evento restaura a aba de candidatos sem perder o layout por abas', () => {
  const eventDetailSource = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');
  assert.match(eventDetailSource, /TabsTrigger value="candidatos">Candidatos<\/TabsTrigger>/);
  assert.match(eventDetailSource, /TabsContent value="candidatos"/);
  assert.match(eventDetailSource, /Importar candidatos/);
  assert.match(eventDetailSource, /Etiquetas/);
  assert.match(eventDetailSource, /Nenhum candidato disponível para geração de etiquetas\./);
});
