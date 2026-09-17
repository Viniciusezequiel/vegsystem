import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail = fs.readFileSync(new URL('../../src/pages/processo-seletivo/PsEventDetail.tsx', import.meta.url), 'utf8');

test('replacement dialog provides a searchable active-collaborator combobox', () => {
  assert.match(detail, /Pesquisar e selecionar um fiscal ativo/);
  assert.match(detail, /CommandInput placeholder="Buscar por nome, e-mail, instituição, unidade ou setor/);
  assert.match(detail, /candidate\.full_name, candidate\.email, candidate\.institution, candidate\.unit, candidate\.sector/);
  assert.match(detail, /Nenhum fiscal ativo encontrado/);
  assert.match(detail, /candidate\.active && !currentIds\.has\(candidate\.id\)/);
});
