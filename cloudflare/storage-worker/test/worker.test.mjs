import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapability } from '../src/capability.mjs';
import { createApp } from '../src/index.mjs';

const testCapabilitySecret = 'unit-test-only-capability-secret-value';

class FakeObject {
  constructor(bytes, options = {}) {
    this.bytes = bytes;
    this.body = bytes;
    this.size = bytes.byteLength;
    this.etag = 'fake-etag';
    this.httpEtag = '"fake-etag"';
    this.httpMetadata = options.httpMetadata ?? {};
  }
  writeHttpMetadata(headers) {
    if (this.httpMetadata.contentType) headers.set('content-type', this.httpMetadata.contentType);
  }
}

class FakeBucket {
  objects = new Map();
  async head(key) { return this.objects.get(key) ?? null; }
  async get(key) { return this.objects.get(key) ?? null; }
  async put(key, value, options) { this.objects.set(key, new FakeObject(value, options)); }
  async delete(key) { this.objects.delete(key); }
}

function setup(overrides = {}) {
  const bucket = new FakeBucket();
  const auth = { sub: 'user-id', sessionId: 'session-id', token: 'jwt' };
  const app = createApp({
    verifyJwt: overrides.verifyJwt ?? (async request => {
      if (!request.headers.has('authorization')) throw new Error('unauthorized');
      return auth;
    }),
    authorize: overrides.authorize ?? (async () => true),
    hasReference: overrides.hasReference ?? (async () => false),
  });
  const env = {
    LOST_ITEMS_BUCKET: bucket,
    TASK_ATTACHMENTS_BUCKET: new FakeBucket(),
    CAPABILITY_SIGNING_SECRET: testCapabilitySecret,
    FILE_URL_TTL_SECONDS: '300',
    MAX_LOST_ITEM_BYTES: '1024',
    MAX_SIGNATURE_BYTES: '1024',
    ENABLE_SIGNATURES: 'true',
    PS_SIGNATURE_INTERNAL_SECRET: 'unit-test-process-selection-secret-123456789',
    ALLOWED_ORIGINS: 'https://www.vegsystem.site',
  };
  return { app, env, bucket };
}

const webp = new Uint8Array([82,73,70,70,4,0,0,0,87,69,66,80,1,2,3,4]);
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const authHeaders = { authorization: 'Bearer test' };

test('rotas autenticadas rejeitam anônimo', async () => {
  const { app, env } = setup();
  const response = await app.fetch(new Request('https://worker.test/v1/files/resolve', {
    method: 'POST', body: JSON.stringify({ locators: ['r2/lost-items/a.webp'] }), headers: { 'content-type': 'application/json' },
  }), env, {});
  assert.equal(response.status, 401);
});

test('usuário sem user_roles recebe 403', async () => {
  const { app, env } = setup({ authorize: async () => false });
  const response = await app.fetch(new Request('https://worker.test/v1/files/resolve', {
    method: 'POST', body: JSON.stringify({ locators: ['r2/lost-items/a.webp'] }),
    headers: { ...authHeaders, 'content-type': 'application/json' },
  }), env, {});
  assert.equal(response.status, 403);
});

test('task-attachments permanece desabilitado sem configuração explícita', async () => {
  const { app, env } = setup();
  const upload = await app.fetch(new Request('https://worker.test/v1/files/task-attachments', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/pdf' }, body: '%PDF-test',
  }), env, {});
  assert.equal(upload.status, 404);

  const resolve = await app.fetch(new Request('https://worker.test/v1/files/resolve', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ locators: ['r2/task-attachments/file.pdf'] }),
  }), env, {});
  assert.equal(resolve.status, 404);
});

test('resolve em lote gera capability e GET/HEAD servem objeto privado', async () => {
  const { app, env, bucket } = setup();
  await bucket.put('a.webp', webp, { httpMetadata: { contentType: 'image/webp' } });
  const resolve = await app.fetch(new Request('https://worker.test/v1/files/resolve', {
    method: 'POST', body: JSON.stringify({ locators: ['r2/lost-items/a.webp'] }),
    headers: { ...authHeaders, 'content-type': 'application/json' },
  }), env, {});
  assert.equal(resolve.status, 200);
  const url = (await resolve.json()).files[0].url;
  const get = await app.fetch(new Request(url), env, {});
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('content-type'), 'image/webp');
  assert.deepEqual(new Uint8Array(await get.arrayBuffer()), webp);
  const head = await app.fetch(new Request(url, { method: 'HEAD' }), env, {});
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test('capability adulterada não lê objeto', async () => {
  const { app, env, bucket } = setup();
  await bucket.put('a.webp', webp);
  const exp = Math.floor(Date.now() / 1000) + 300;
  const cap = await createCapability(env.CAPABILITY_SIGNING_SECRET, 'lost-items', 'a.webp', exp);
  const response = await app.fetch(new Request(`https://worker.test/v1/objects/lost-items/b.webp?exp=${exp}&sig=${cap.sig}`), env, {});
  assert.equal(response.status, 403);
});

test('upload aceita WebP válido, gera locator e confirma armazenamento', async () => {
  const { app, env, bucket } = setup();
  const response = await app.fetch(new Request('https://worker.test/v1/files/lost-items', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'image/webp' }, body: webp,
  }), env, {});
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.locator, /^r2\/lost-items\/\d{4}\/\d{2}\/[0-9a-f-]+-[0-9a-f]{16}\.webp$/);
  assert.equal(bucket.objects.size, 1);
});

test('upload rejeita MIME/assinatura incompatíveis', async () => {
  const { app, env } = setup();
  const response = await app.fetch(new Request('https://worker.test/v1/files/lost-items', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'image/webp' }, body: new Uint8Array([1,2,3]) },
  ), env, {});
  assert.equal(response.status, 415);
});

test('upload de assinatura aceita somente PNG e retorna locator sem capability', async () => {
  const { app, env, bucket } = setup();
  const response = await app.fetch(new Request('https://worker.test/v1/files/signatures/equipment', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'image/png' }, body: png,
  }), env, {});
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.locator, /^r2\/signatures\/equipment\/\d{4}\/\d{2}\/[0-9a-f-]+-[0-9a-f]{16}\.png$/);
  assert.deepEqual(Object.keys(result), ['locator', 'size', 'content_type', 'checksum_short']);
  assert.equal([...bucket.objects.keys()].every(key => key.startsWith('signatures/equipment/')), true);

  const invalidMime = await app.fetch(new Request('https://worker.test/v1/files/signatures/equipment', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'image/webp' }, body: webp,
  }), env, {});
  assert.equal(invalidMime.status, 415);
  const invalidModule = await app.fetch(new Request('https://worker.test/v1/files/signatures/admin', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'image/png' }, body: png,
  }), env, {});
  assert.equal(invalidModule.status, 400);
});

test('endpoint interno process-selection exige segredo, força PNG e faz cleanup exato', async () => {
  const { app, env, bucket } = setup();
  const endpoint = 'https://worker.test/v1/internal/signatures/process-selection';
  assert.equal((await app.fetch(new Request(endpoint, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png }), env, {})).status, 404);
  const headers = { 'x-ps-signature-secret': env.PS_SIGNATURE_INTERNAL_SECRET, 'content-type': 'image/png' };
  const upload = await app.fetch(new Request(endpoint, { method: 'POST', headers, body: png }), env, {});
  assert.equal(upload.status, 201);
  const receipt = await upload.json();
  assert.match(receipt.locator, /^r2\/signatures\/process-selection\//);
  assert.equal(receipt.size, png.length);
  assert.equal(receipt.content_type, 'image/png');
  assert.equal(bucket.objects.size, 1);
  const cleanup = await app.fetch(new Request(endpoint, {
    method: 'DELETE', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ locator: receipt.locator }),
  }), env, {});
  assert.equal(cleanup.status, 200);
  assert.equal(bucket.objects.size, 0);
});

test('resolve de assinatura exige referência visível e serve PNG por capability curta', async () => {
  const locator = 'r2/signatures/process-selection/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
  const key = 'signatures/process-selection/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
  const denied = setup({ hasReference: async () => false });
  await denied.bucket.put(key, png, { httpMetadata: { contentType: 'image/png' } });
  const request = () => new Request('https://worker.test/v1/files/resolve', {
    method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ locators: [locator] }),
  });
  assert.equal((await denied.app.fetch(request(), denied.env, {})).status, 403);

  const allowed = setup({ hasReference: async () => true });
  await allowed.bucket.put(key, png, { httpMetadata: { contentType: 'image/png' } });
  const response = await allowed.app.fetch(request(), allowed.env, {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.files[0].locator, locator);
  assert.equal(payload.files[0].url.includes('sig='), true);
  const get = await allowed.app.fetch(new Request(payload.files[0].url), allowed.env, {});
  assert.equal(get.status, 200);
  assert.equal(get.headers.get('content-type'), 'image/png');
});

test('DELETE de assinatura preserva referência e usa somente a key física exata', async () => {
  const locator = 'r2/signatures/lockers/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
  const key = 'signatures/lockers/2026/09/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.png';
  const guarded = setup({ hasReference: async () => true });
  await guarded.bucket.put(key, png);
  assert.equal((await guarded.app.fetch(new Request(`https://worker.test/v1/files/${locator.slice(3)}`, {
    method: 'DELETE', headers: authHeaders,
  }), guarded.env, {})).status, 409);
  assert.ok(await guarded.bucket.head(key));
});

test('DELETE preserva objeto referenciado', async () => {
  const { app, env, bucket } = setup({ hasReference: async () => true });
  await bucket.put('a.webp', webp);
  const response = await app.fetch(new Request('https://worker.test/v1/files/lost-items/a.webp', { method: 'DELETE', headers: authHeaders }), env, {});
  assert.equal(response.status, 409);
  assert.ok(await bucket.head('a.webp'));
});

test('DELETE falha fechado quando consulta de referências falha', async () => {
  const { app, env, bucket } = setup({ hasReference: async () => { throw new Error('db'); } });
  await bucket.put('a.webp', webp);
  const response = await app.fetch(new Request('https://worker.test/v1/files/lost-items/a.webp', { method: 'DELETE', headers: authHeaders }), env, {});
  assert.equal(response.status, 503);
  assert.ok(await bucket.head('a.webp'));
});

test('DELETE remove apenas a key exata sem referências', async () => {
  const { app, env, bucket } = setup();
  await bucket.put('a.webp', webp);
  await bucket.put('b.webp', webp);
  const response = await app.fetch(new Request('https://worker.test/v1/files/lost-items/a.webp', { method: 'DELETE', headers: authHeaders }), env, {});
  assert.equal(response.status, 200);
  assert.equal(await bucket.head('a.webp'), null);
  assert.ok(await bucket.head('b.webp'));
});

test('origem não permitida não recebe CORS', async () => {
  const { app, env } = setup();
  const response = await app.fetch(new Request('https://worker.test/not-found', { headers: { origin: 'https://evil.test' } }), env, {});
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
