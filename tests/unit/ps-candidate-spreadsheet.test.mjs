import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';

import {
  normalizePsCandidateHeader,
  parsePsCandidateWorkbook,
  PS_CANDIDATE_TEMPLATE_COLUMNS,
} from '../../src/lib/psCandidateSpreadsheet.ts';

test('normalizes accented candidate spreadsheet headers and separators', () => {
  assert.equal(normalizePsCandidateHeader('  Prédio\nde prova: '), 'PREDIO DE PROVA');
  assert.equal(normalizePsCandidateHeader('Campus / unidade'), 'CAMPUS UNIDADE');
});

test('imports campus and building from common spreadsheet header variations', () => {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      'NOME COMPLETO': 'Maria Silva',
      'NÚMERO DE INSCRIÇÃO': '000805',
      'Campus / unidade': 'Campus I',
      'Prédio\nde prova:': 'FEA',
      'SALA DE PROVA': '501/502',
    },
    {
      CANDIDATO: 'João Souza',
      INSCRICAO: '000806',
      'LOCAL DE PROVA': 'Campus II',
      BLOCO: 'FCH',
      SALA: '101',
    },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidatos');

  const result = parsePsCandidateWorkbook(workbook, 'event-1');

  assert.equal(result.rows.length, 2);
  assert.equal(result.campusCount, 2);
  assert.equal(result.buildingCount, 2);
  assert.deepEqual(
    result.rows.map(({ full_name, registration_number, campus, building, room }) => ({
      full_name,
      registration_number,
      campus,
      building,
      room,
    })),
    [
      { full_name: 'Maria Silva', registration_number: '000805', campus: 'Campus I', building: 'FEA', room: '501/502' },
      { full_name: 'João Souza', registration_number: '000806', campus: 'Campus II', building: 'FCH', room: '101' },
    ],
  );
});

test('candidate template explicitly contains campus and building columns', () => {
  assert.ok(PS_CANDIDATE_TEMPLATE_COLUMNS.includes('CAMPUS'));
  assert.ok(PS_CANDIDATE_TEMPLATE_COLUMNS.includes('PRÉDIO'));
});
