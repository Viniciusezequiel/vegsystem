import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getSignatureSource, parseSignatureLocator, preparePdfSignatureRows } from '../../src/lib/signatureStorageCore.mjs';

const locator = 'r2/signatures/process-selection/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
const inline = 'data:image/png;base64,iVBORw0KGgo=';

test('reconhece Base64 legado e locator R2 canônico de assinatura', () => {
  assert.equal(getSignatureSource(inline).provider, 'inline');
  assert.equal(getSignatureSource(locator).provider, 'r2');
  assert.equal(parseSignatureLocator(locator).module, 'process-selection');
  assert.equal(getSignatureSource(null).provider, 'none');
});

test('rejeita módulo, extensão, data URL e locator malformados', () => {
  for (const value of [
    locator.replace('process-selection', 'admin'),
    locator.replace('.png', '.jpg'),
    'r2/signatures/equipment/../../secret.png',
    'data:image/jpeg;base64,/9j/',
    'https://public.example/signature.png',
  ]) assert.equal(getSignatureSource(value).provider, 'invalid', value);
});

test('PDF preserva Base64 legado e resolve R2 apenas sob demanda', async () => {
  const calls = [];
  const rows = await preparePdfSignatureRows([
    { id: 'legacy', signature_url: inline },
    { id: 'r2', signature_url: locator },
    { id: 'empty', signature_url: null },
  ], async value => { calls.push(value); return inline; });
  assert.equal(rows[0].signature_url, inline);
  assert.equal(rows[1].signature_url, inline);
  assert.equal(rows[2].signature_url, null);
  assert.deepEqual(calls, [locator]);
});

test('helpers não persistem capability ou assinatura resolvida', () => {
  const files = ['../../src/lib/signatureStorageCore.mjs', '../../src/lib/signatureStorage.ts'];
  const source = files.map(file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});
