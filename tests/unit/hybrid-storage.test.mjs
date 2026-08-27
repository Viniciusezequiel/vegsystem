import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getStorageProvider, R2CapabilityResolver } from '../../src/lib/r2CapabilityResolver.mjs';

const workerUrl = 'https://worker.example.test';
const locators = [
  'r2/lost-items/2026/08/one.webp',
  'r2/lost-items/2026/08/two.webp',
];

function createHarness({ status = 200, now = 1_000_000, expiresIn = 300 } = {}) {
  const calls = [];
  const resolver = new R2CapabilityResolver({
    workerUrl,
    getAccessToken: async () => 'test-access-token',
    now: () => now,
    batchWindowMs: 0,
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      const requested = JSON.parse(init.body).locators;
      return new Response(JSON.stringify({
        files: requested.map(locator => ({
          locator,
          url: `${workerUrl}/capability/${encodeURIComponent(locator)}`,
          expires_at: Math.floor(now / 1000) + expiresIn,
        })),
      }), { status, headers: { 'content-type': 'application/json' } });
    },
  });
  return { resolver, calls, setNow(value) { now = value; } };
}

test('classifica locators Supabase, optimized, R2 e null', () => {
  assert.equal(getStorageProvider('legacy/photo.jpg'), 'supabase');
  assert.equal(getStorageProvider('optimized/v1/photo.webp'), 'supabase');
  assert.equal(getStorageProvider('https://project.supabase.co/storage/v1/object/public/lost-items/photo.jpg'), 'supabase');
  assert.equal(getStorageProvider(locators[0]), 'r2');
  assert.equal(getStorageProvider(null), 'none');
});

test('R2 usa Worker com JWT somente no header', async () => {
  const { resolver, calls } = createHarness();
  const result = await resolver.resolve(locators[0]);
  assert.match(result, /^https:\/\/worker\.example\.test\/capability\//);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${workerUrl}/v1/files/resolve`);
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-access-token');
  assert.equal(calls[0].url.includes('test-access-token'), false);
});

test('capability válida é reutilizada somente em memória', async () => {
  const { resolver, calls } = createHarness();
  const first = await resolver.resolve(locators[0]);
  const second = await resolver.resolve(locators[0]);
  assert.equal(second, first);
  assert.equal(calls.length, 1);
});

test('capability perto da expiração é renovada', async () => {
  const harness = createHarness();
  await harness.resolver.resolve(locators[0]);
  harness.setNow(1_271_000); // restam 29 segundos: abaixo da margem de 30s
  await harness.resolver.resolve(locators[0]);
  assert.equal(harness.calls.length, 2);
});

test('resolves concorrentes do mesmo locator são deduplicados', async () => {
  const { resolver, calls } = createHarness();
  const [a, b, c] = await Promise.all([
    resolver.resolve(locators[0]), resolver.resolve(locators[0]), resolver.resolve(locators[0]),
  ]);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.locators, [locators[0]]);
});

test('múltiplos locators são resolvidos em um único lote', async () => {
  const { resolver, calls } = createHarness();
  const results = await resolver.resolveMany(locators);
  assert.equal(results.length, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.locators, locators);
});

test('lotes nunca ultrapassam o limite de 50 locators', async () => {
  const { resolver, calls } = createHarness();
  const many = Array.from({ length: 51 }, (_, index) => `r2/lost-items/2026/08/${index}.webp`);
  const results = await resolver.resolveMany(many);
  assert.equal(results.length, 51);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.body.locators.length).sort((a, b) => a - b), [1, 50]);
});

for (const status of [401, 403, 404, 429, 500, 503]) {
  test(`falha HTTP ${status} retorna imagem indisponível sem retry`, async () => {
    const { resolver, calls } = createHarness({ status });
    assert.equal(await resolver.resolve(locators[0]), null);
    assert.equal(calls.length, 1);
  });
}

test('Worker indisponível retorna null sem retry infinito', async () => {
  let calls = 0;
  const resolver = new R2CapabilityResolver({
    workerUrl,
    getAccessToken: async () => 'token',
    batchWindowMs: 0,
    fetchImpl: async () => { calls += 1; throw new Error('offline'); },
  });
  assert.equal(await resolver.resolve(locators[0]), null);
  assert.equal(calls, 1);
});

test('ausência de sessão ou Worker é segura', async () => {
  let fetchCalls = 0;
  const resolver = new R2CapabilityResolver({
    workerUrl,
    getAccessToken: async () => null,
    batchWindowMs: 0,
    fetchImpl: async () => { fetchCalls += 1; return new Response(); },
  });
  assert.equal(await resolver.resolve(locators[0]), null);
  assert.equal(fetchCalls, 0);
  const unconfigured = new R2CapabilityResolver({ workerUrl: '', getAccessToken: async () => 'token' });
  assert.equal(await unconfigured.resolve(locators[0]), null);
});

test('capabilities não são persistidas', () => {
  const core = fs.readFileSync(new URL('../../src/lib/r2CapabilityResolver.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(core, /localStorage|sessionStorage/);
});
