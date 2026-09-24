import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPsAttendanceLocation,
  normalizePsLocation,
} from '../../src/lib/psLocationNormalization.mjs';

test('agrupa variações de escrita do mesmo prédio', () => {
  const variants = ['FACE I', 'Prédio Face I', 'PRÉDIO - FACE I'];
  const keys = variants.map((building) =>
    getPsAttendanceLocation({ campus: '', unit: 'FUMEC', building }).key
  );

  assert.deepEqual(new Set(keys), new Set(['FUMEC|||FACE I']));
});

test('mantém campus distintos separados e exibe rótulos consistentes', () => {
  const first = getPsAttendanceLocation({ campus: 'Campus I', building: 'Prédio FEA' });
  const second = getPsAttendanceLocation({ campus: 'campus ii', building: 'FEA' });

  assert.equal(first.building, 'FEA');
  assert.equal(first.campusLabel, 'CAMPUS I');
  assert.notEqual(first.key, second.key);
});

test('ignora marcadores vazios e usa a unidade como localização de apoio', () => {
  const location = getPsAttendanceLocation({ campus: '', unit: 'FUMEC', building: '-' });

  assert.equal(location.building, 'FUMEC');
  assert.equal(location.key, 'FUMEC|||FUMEC');
  assert.equal(normalizePsLocation('Prédio – Face II', { building: true }), 'FACE II');
});

