import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');

test('replacement dialog provides a searchable active-collaborator combobox', () => {
  assert.match(detail, /Escolha o substituto/);
  assert.match(detail, /CommandInput placeholder="Buscar por nome, e-mail, instituição ou unidade/);
  assert.match(detail, /candidate\.full_name,[\s\S]*candidate\.email,[\s\S]*candidate\.institution,[\s\S]*candidate\.unit,[\s\S]*candidate\.sector/);
  assert.match(detail, /Nenhum fiscal encontrado/);
  assert.match(detail, /candidate\.active &&[\s\S]*!currentIds\.has\(candidate\.id\)/);
  assert.match(detail, /sameDayConflict/);
});
