import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSelfEvaluationEnabled,
  filterPublicRoster,
} from '../../src/lib/psPublicFilters.mjs';

test('autoavaliação só aparece quando o evento foi explicitamente habilitado', () => {
  assert.equal(isSelfEvaluationEnabled({ self_evaluation_enabled: true }), true);
  assert.equal(isSelfEvaluationEnabled({ hidden_from_evaluation: false }), false);
  assert.equal(isSelfEvaluationEnabled({}), false);
});

test('lista pública mostra todos os fiscais por default e filtra em tempo real pelo texto', () => {
  const rows = [
    { id: '1', collaborator_name: 'Ana Silva', role_name: 'Fiscal de Sala', email: 'ana@empresa.com' },
    { id: '2', collaborator_name: 'Bruno Costa', role_name: 'Coordenador', email: 'bruno@empresa.com' },
    { id: '3', collaborator_name: 'Carla Dias', role_name: 'Fiscal de Sala', email: 'carla@empresa.com' },
  ];

  assert.equal(filterPublicRoster(rows, '').length, 3);
  assert.deepEqual(filterPublicRoster(rows, 'ana').map((row) => row.id), ['1']);
  assert.deepEqual(filterPublicRoster(rows, 'coorden').map((row) => row.id), ['2']);
});
