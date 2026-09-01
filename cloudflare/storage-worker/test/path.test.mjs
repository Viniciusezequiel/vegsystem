import test from 'node:test';
import assert from 'node:assert/strict';
import { parseR2Locator, parseScopedRoute, parseSignatureUploadPath, validateKey } from '../src/path.mjs';

test('aceita somente locators R2 canônicos e scopes conhecidos', () => {
  assert.deepEqual(parseR2Locator('r2/lost-items/2026/08/photo-a.webp'), {
    scope: 'lost-items', key: '2026/08/photo-a.webp', locator: 'r2/lost-items/2026/08/photo-a.webp',
  });
  assert.equal(parseR2Locator('optimized/v1/legacy.webp'), null);
  assert.equal(parseR2Locator('https://example.com/file.webp'), null);
  assert.equal(parseR2Locator('r2/unknown/file.webp'), null);
});

test('assinaturas aceitam somente namespace, módulo e nome canônicos', () => {
  const locator = 'r2/signatures/equipment/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
  assert.deepEqual(parseR2Locator(locator), {
    scope: 'signatures',
    key: 'equipment/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png',
    locator,
  });
  for (const invalid of [
    locator.replace('/equipment/', '/unknown/'),
    locator.replace('/09/', '/13/'),
    locator.replace('.png', '.webp'),
    'r2/signatures/equipment/arbitrary.png',
  ]) assert.equal(parseR2Locator(invalid), null, invalid);
  assert.equal(parseSignatureUploadPath('/v1/files/signatures/lockers'), 'lockers');
  assert.equal(parseSignatureUploadPath('/v1/files/signatures/unknown'), null);
});

test('rejeita traversal, barras ambíguas e controles', () => {
  for (const key of ['../x', 'a/../x', '/x', 'x/', 'a//x', 'a\\x', 'a\0x']) {
    assert.equal(validateKey(key), false, key);
  }
  assert.equal(parseScopedRoute('/v1/files/lost-items/a%2F..%2Fx', '/v1/files/'), null);
  assert.ok(parseScopedRoute('/v1/files/lost-items/a%2Fb.webp', '/v1/files/'));
});
