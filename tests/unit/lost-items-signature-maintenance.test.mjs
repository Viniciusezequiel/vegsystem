import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('../../public/maintenance-lost-item-signatures.html', import.meta.url),
  'utf8'
);

test('manutenção exige sessão admin real antes de qualquer escrita', () => {
  assert.match(source, /get_my_storage_access/);
  assert.match(source, /roles\.includes\('admin'\)/);
  assert.match(source, /session_missing|Faça login/);
});

test('manutenção é limitada aos dois resíduos auditados', () => {
  assert.match(source, /99c4db0d-65ec-49e9-8df3-a614c52becf0/);
  assert.match(source, /32f4eda5-1d1e-45d8-abef-1ca07441f515/);
  assert.match(source, /code: '785453'/);
  assert.match(source, /code: '463726'/);
  assert.match(source, /active\.length !== TARGETS\.length/);
  assert.match(source, /archived\.length !== 0/);
});

test('migração valida PNG e SHA-256 antes do update', () => {
  assert.match(source, /data:image\/png;base64,/);
  assert.match(source, /invalid_png_magic/);
  assert.match(source, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(source, /upload_checksum_mismatch/);
  assert.match(source, /upload_size_mismatch/);
});

test('troca no banco é condicional e exatamente de uma linha', () => {
  assert.match(source, /update_lost_item_signature_locator/);
  assert.match(source, /p_expected_value: original/);
  assert.match(source, /p_new_locator: locator/);
  assert.match(source, /rows_updated\) !== 1/);
});

test('falha antes do update tenta limpar objeto órfão', () => {
  assert.match(source, /cleanupUnreferenced\(locator\)/);
  assert.match(source, /v1\/files\/\$\{locator\.slice\(3\)\}/);
});

test('falha após update nunca apaga objeto já referenciado', () => {
  assert.match(source, /O banco já referencia o locator\. Nunca apague o objeto neste estado\./);
  assert.match(source, /post_update_validation_failed/);
});

test('execução é sequencial e valida leitura final do R2', () => {
  assert.match(source, /for \(const target of TARGETS\)/);
  assert.doesNotMatch(source, /Promise\.all\([^)]*migrateOne/);
  assert.match(source, /v1\/files\/resolve/);
  assert.match(source, /r2_read_checksum_mismatch/);
});

test('encerramento exige zero Base64 residual e locator R2 nos dois alvos', () => {
  assert.match(source, /remainingActive\.length !== 0 \|\| remainingArchive\.length !== 0/);
  assert.match(source, /startsWith\('r2\/signatures\/lost-items\/'\)/);
  assert.match(source, /2\/2 assinaturas migradas, 0 Base64 residuais/);
});
