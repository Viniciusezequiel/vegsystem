import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getSignatureDisplayState, getSignatureSource, parseSignatureLocator, preparePdfSignatureRows } from '../../src/lib/signatureStorageCore.mjs';

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

test('detalhe exibe Base64 imediatamente e não resolve valor null', () => {
  assert.deepEqual(getSignatureDisplayState(inline, 'equipment'), { status: 'ready', source: inline });
  assert.deepEqual(getSignatureDisplayState(null, 'equipment'), { status: 'empty', source: null });
});

test('detalhe resolve locator R2 de equipment e rejeita módulo divergente', () => {
  const equipment = locator.replace('process-selection', 'equipment');
  assert.deepEqual(getSignatureDisplayState(equipment, 'equipment'), {
    status: 'resolving', source: null, locator: equipment,
  });
  assert.deepEqual(getSignatureDisplayState(locator, 'equipment'), { status: 'error', source: null });
});

test('retirada e devolução usam o mesmo renderer provider-aware com fallback de erro', () => {
  for (const [file, module] of [
    ['../../src/components/equipment/EquipmentLoanDetailsDialog.tsx', 'equipment'],
    ['../../src/components/lockers/LockerLoanDetailsDialog.tsx', 'lockers'],
  ]) {
    const component = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(component, new RegExp(`value=\\{loan\\.borrower_signature\\}[\\s\\S]*expectedModule="${module}"`));
    assert.match(component, new RegExp(`value=\\{loan\\.return_signature\\}[\\s\\S]*expectedModule="${module}"`));
    assert.doesNotMatch(component, /<img\s+src=\{loan\.(?:borrower_signature|return_signature)\}/);
  }
  const renderer = fs.readFileSync(new URL('../../src/components/ui/ProviderAwareSignatureImage.tsx', import.meta.url), 'utf8');
  assert.match(renderer, /Assinatura indisponível/);
  assert.match(renderer, /cancelled = true/);
});
