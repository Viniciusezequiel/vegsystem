import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../../supabase/migrations/20260917193000_evaluator_multi_scope.sql', import.meta.url),
  'utf8',
);
const page = readFileSync(
  new URL('../../src/pages/processo-seletivo/PsEvaluatorManagement.tsx', import.meta.url),
  'utf8',
);

test('migração não concede escopo global automaticamente', () => {
  assert.doesNotMatch(migration, /CREATE (?:CONSTRAINT )?TRIGGER/i);
  assert.match(migration, /explicit administrator control/);
});

test('administrador pode substituir o escopo por até vinte locais validados', () => {
  assert.match(migration, /ps_admin_replace_evaluator_scopes/);
  assert.match(migration, /jsonb_array_length\(p_scopes\) > 20/);
  assert.match(migration, /event_scope_must_be_exclusive/);
  assert.match(migration, /GRANT EXECUTE[\s\S]*TO authenticated/);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
});

test('gestão exibe evento inteiro, múltiplos locais e editor sem colunas vazias', () => {
  assert.match(page, /Evento inteiro/);
  assert.match(page, /Locais específicos/);
  assert.match(page, /Adicionar outro local/);
  assert.match(page, /Área de atuação/);
  assert.doesNotMatch(page, /\['Nome', 'CPF', 'Função', 'Campus', 'Prédio', 'Andar'/);
});
