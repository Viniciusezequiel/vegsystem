import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LostItemStorageClient,
  processImageBatchIndependently,
  persistNewImageSafely,
  r2NewUploadsEnabled,
  replaceImageSafely,
  validateR2LostItemLocator,
} from '../../src/lib/lostItemStorageCore.mjs';

const workerUrl = 'https://worker.example.test';
const r2Locator = 'r2/lost-items/2026/08/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.webp';
const replacementR2Locator = 'r2/lost-items/2026/08/223e4567-e89b-42d3-a456-426614174000-fedcba9876543210.webp';
const file = new Blob(['RIFFmockWEBP'], { type: 'image/webp' });

function response(status, body = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function harness({ flag = 'true', status = 201, body = { locator: r2Locator }, token = 'access-token' } = {}) {
  const calls = [];
  const supabaseUploads = [];
  const supabaseDeletes = [];
  const client = new LostItemStorageClient({
    uploadsFlag: flag,
    workerUrl,
    getAccessToken: async () => token,
    uploadSupabase: async (_file, path) => { supabaseUploads.push(path); return path; },
    deleteSupabase: async path => { supabaseDeletes.push(path); },
    fetchImpl: async (url, init) => { calls.push({ url, init }); return response(status, body); },
  });
  return { client, calls, supabaseUploads, supabaseDeletes };
}

test('flag ausente mantém Supabase', () => assert.equal(r2NewUploadsEnabled(undefined), false));
test('flag false mantém Supabase', () => assert.equal(r2NewUploadsEnabled('false'), false));
test('somente true explícito habilita R2', () => {
  assert.equal(r2NewUploadsEnabled('true'), true);
  assert.equal(r2NewUploadsEnabled('TRUE'), false);
  assert.equal(r2NewUploadsEnabled(true), false);
});

test('upload Supabase permanece inalterado com flag false', async () => {
  const h = harness({ flag: 'false' });
  const result = await h.client.upload(file, 'legacy/new.webp');
  assert.deepEqual(result, { locator: 'legacy/new.webp', provider: 'supabase' });
  assert.deepEqual(h.supabaseUploads, ['legacy/new.webp']);
  assert.equal(h.calls.length, 0);
});

test('upload R2 retorna locator validado', async () => {
  const h = harness();
  assert.deepEqual(await h.client.upload(file, 'unused.webp'), { locator: r2Locator, provider: 'r2' });
  assert.equal(h.calls[0].url, `${workerUrl}/v1/files/lost-items`);
});

test('cadastro inicial e replace fazem exatamente um POST cada e aguardam seus 201', async () => {
  const calls = [];
  let releaseReplacement;
  const replacementResponse = new Promise(resolve => { releaseReplacement = resolve; });
  const client = new LostItemStorageClient({
    uploadsFlag: 'true', workerUrl,
    getAccessToken: async () => 'access-token',
    uploadSupabase: async () => { throw new Error('unexpected Supabase upload'); },
    deleteSupabase: async () => { throw new Error('unexpected Supabase delete'); },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) return response(201, { locator: r2Locator });
      if (calls.length === 2) return replacementResponse;
      throw new Error('duplicate request');
    },
  });

  const inserted = await persistNewImageSafely({
    upload: () => client.upload(file, 'initial.webp'),
    persist: async locator => locator,
    cleanupNew: async () => {},
  });
  assert.equal(inserted.uploaded.locator, r2Locator);

  const order = [];
  let replaceSettled = false;
  const replacing = replaceImageSafely({
    oldLocator: r2Locator,
    upload: () => client.upload(file, 'replacement.webp'),
    update: async locator => { order.push(`update:${locator}`); return locator; },
    cleanupNew: async locator => order.push(`cleanup-new:${locator}`),
    cleanupOld: async locator => { order.push(`cleanup-old:${locator}`); return { removed: true }; },
  }).then(result => { replaceSettled = true; return result; });

  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(replaceSettled, false);
  assert.equal(calls.length, 2);
  assert.deepEqual(order, []);
  releaseReplacement(response(201, { locator: replacementR2Locator }));

  const replaced = await replacing;
  assert.equal(replaced.uploaded.locator, replacementR2Locator);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => [call.url, call.init.method]), [
    [`${workerUrl}/v1/files/lost-items`, 'POST'],
    [`${workerUrl}/v1/files/lost-items`, 'POST'],
  ]);
  assert.deepEqual(order, [
    `update:${replacementR2Locator}`,
    `cleanup-old:${r2Locator}`,
  ]);
});

test('fetch default preserva receiver global no upload e DELETE R2', async () => {
  const originalFetch = globalThis.fetch;
  const receivers = [];
  globalThis.fetch = function receiverSensitiveFetch(url, init) {
    receivers.push(this);
    assert.equal(this, globalThis);
    return init.method === 'DELETE'
      ? response(200, { deleted: true, locator: r2Locator })
      : response(201, { locator: r2Locator });
  };
  try {
    const client = new LostItemStorageClient({
      uploadsFlag: 'true', workerUrl,
      getAccessToken: async () => 'access-token',
      uploadSupabase: async () => { throw new Error('unexpected Supabase upload'); },
      deleteSupabase: async () => { throw new Error('unexpected Supabase delete'); },
    });
    await client.upload(file, 'unused.webp');
    await client.delete(r2Locator);
    assert.deepEqual(receivers, [globalThis, globalThis]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetch injetado é chamado sem receiver e preserva Authorization', async () => {
  const calls = [];
  async function receiverSensitiveMock(url, init) {
    assert.equal(this, undefined);
    calls.push({ url, init });
    return init.method === 'DELETE'
      ? response(200, { deleted: true, locator: r2Locator })
      : response(201, { locator: r2Locator });
  }
  const client = new LostItemStorageClient({
    uploadsFlag: 'true', workerUrl,
    getAccessToken: async () => 'access-token',
    uploadSupabase: async () => { throw new Error('unexpected Supabase upload'); },
    deleteSupabase: async () => { throw new Error('unexpected Supabase delete'); },
    fetchImpl: receiverSensitiveMock,
  });
  await client.upload(file, 'unused.webp');
  await client.delete(r2Locator);
  assert.deepEqual(calls.map(call => call.init.headers.authorization), ['Bearer access-token', 'Bearer access-token']);
  assert.equal(calls.every(call => !call.url.includes('access-token')), true);
});

test('upload envia JWT somente no Authorization', async () => {
  const h = harness();
  await h.client.upload(file, 'unused.webp');
  assert.equal(h.calls[0].init.headers.authorization, 'Bearer access-token');
  assert.equal(h.calls[0].url.includes('access-token'), false);
  assert.equal(JSON.stringify(h.calls[0].init).includes('refresh_token'), false);
  assert.equal(JSON.stringify(h.calls[0].init).includes('user_id'), false);
});

test('upload sem sessão falha antes da rede', async () => {
  const h = harness({ token: null });
  await assert.rejects(h.client.upload(file, 'unused.webp'), error => error.status === 401 && error.code === 'missing_session');
  assert.equal(h.calls.length, 0);
});

for (const status of [400, 401, 403, 404, 413, 429, 500, 503]) {
  test(`upload trata Worker ${status} sem fallback Supabase`, async () => {
    const h = harness({ status, body: { error: `http_${status}` } });
    await assert.rejects(h.client.upload(file, 'must-not-upload.webp'), error => error.status === status);
    assert.equal(h.supabaseUploads.length, 0);
    assert.equal(h.calls.length, 1);
  });
}

test('locator R2 inválido retornado pelo Worker é rejeitado', async () => {
  const h = harness({ body: { locator: 'https://external.example/image.webp' } });
  await assert.rejects(h.client.upload(file, 'unused.webp'), error => error.code === 'invalid_locator');
});

test('insert falha depois do upload e remove somente o novo objeto', async () => {
  const cleaned = [];
  await assert.rejects(persistNewImageSafely({
    upload: async () => ({ locator: r2Locator, provider: 'r2' }),
    persist: async () => { throw new Error('insert failed'); },
    cleanupNew: async locator => cleaned.push(locator),
  }), /insert failed/);
  assert.deepEqual(cleaned, [r2Locator]);
});

test('falha de cleanup identifica possível órfão sem ampliar exclusão', async () => {
  const error = await persistNewImageSafely({
    upload: async () => ({ locator: r2Locator }),
    persist: async () => { throw new Error('insert failed'); },
    cleanupNew: async () => { throw new Error('cleanup failed'); },
  }).catch(value => value);
  assert.equal(error.possibleOrphanLocator, r2Locator);
  assert.equal(error.cleanupError.message, 'cleanup failed');
});

for (const [name, oldLocator, newLocator] of [
  ['Supabase para R2', 'old/photo.jpg', r2Locator],
  ['R2 para R2', 'r2/lost-items/2026/07/old.webp', r2Locator],
  ['R2 para Supabase com flag false', 'r2/lost-items/2026/07/old.webp', 'new/photo.webp'],
]) {
  test(`replace ${name} atualiza antes de limpar antigo`, async () => {
    const order = [];
    const result = await replaceImageSafely({
      oldLocator,
      upload: async () => { order.push('upload'); return { locator: newLocator }; },
      update: async locator => { order.push(`update:${locator}`); return 'updated'; },
      cleanupNew: async locator => order.push(`cleanup-new:${locator}`),
      cleanupOld: async locator => { order.push(`cleanup-old:${locator}`); return { removed: true }; },
    });
    assert.equal(result.value, 'updated');
    assert.deepEqual(order, ['upload', `update:${newLocator}`, `cleanup-old:${oldLocator}`]);
  });
}

test('replace com update falho preserva antigo e remove somente novo', async () => {
  const cleaned = [];
  await assert.rejects(replaceImageSafely({
    oldLocator: 'old/photo.jpg',
    upload: async () => ({ locator: r2Locator }),
    update: async () => { throw new Error('update failed'); },
    cleanupNew: async locator => cleaned.push(locator),
    cleanupOld: async locator => cleaned.push(`old:${locator}`),
  }), /update failed/);
  assert.deepEqual(cleaned, [r2Locator]);
});

test('falha ao limpar imagem antiga não desfaz update confirmado', async () => {
  const result = await replaceImageSafely({
    oldLocator: 'old/photo.jpg',
    upload: async () => ({ locator: r2Locator }),
    update: async () => 'updated',
    cleanupNew: async () => {},
    cleanupOld: async () => { throw new Error('reference unavailable'); },
  });
  assert.equal(result.value, 'updated');
  assert.equal(result.oldCleanup.preserved, true);
});

test('DELETE Supabase nunca chama Worker', async () => {
  const h = harness();
  assert.equal((await h.client.delete('legacy/photo.jpg')).provider, 'supabase');
  assert.deepEqual(h.supabaseDeletes, ['legacy/photo.jpg']);
  assert.equal(h.calls.length, 0);
});

test('DELETE R2 usa somente a key exata no Worker', async () => {
  const h = harness({ status: 200, body: { deleted: true, locator: r2Locator } });
  assert.equal((await h.client.delete(r2Locator)).provider, 'r2');
  assert.equal(h.calls[0].url, `${workerUrl}/v1/files/lost-items/2026/08/123e4567-e89b-42d3-a456-426614174000-0123456789abcdef.webp`);
  assert.equal(h.calls[0].init.method, 'DELETE');
});

for (const status of [404, 409, 500, 503]) {
  test(`DELETE R2 ${status} falha fechado e preserva`, async () => {
    const h = harness({ status, body: { error: 'reference_check', preserved: true } });
    await assert.rejects(h.client.delete(r2Locator), error => error.status === status && error.preserved === true);
  });
}

test('DELETE null é no-op seguro', async () => {
  const h = harness();
  assert.deepEqual(await h.client.delete(null), { removed: false, preserved: true, reason: 'empty' });
  assert.equal(h.calls.length, 0);
});

test('locators R2 inseguros são rejeitados antes da rede', () => {
  assert.equal(validateR2LostItemLocator('r2/lost-items/../secret.webp'), null);
  assert.equal(validateR2LostItemLocator('r2/task-attachments/file.webp'), null);
  assert.equal(validateR2LostItemLocator('r2/lost-items//file.webp'), null);
});

test('archive copia locator e não move objetos', () => {
  const source = fs.readFileSync(new URL('../../src/components/items/ArchiveDeliveredItemsDialog.tsx', import.meta.url), 'utf8');
  assert.match(source, /image_url:\s*item\.image_url/);
  assert.doesNotMatch(source, /uploadLostItemImage|deleteStorageObjectSafely|storage[\s\S]*?\.upload\(/);
});

test('batch isola falha sem remover objetos de outras operações', async () => {
  const touched = [];
  const results = await processImageBatchIndependently([
    async () => { touched.push('one'); return 1; },
    async () => { touched.push('two'); throw new Error('failed'); },
    async () => { touched.push('three'); return 3; },
  ]);
  assert.deepEqual(touched, ['one', 'two', 'three']);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected', 'fulfilled']);
});

test('frontend não contém secrets, listagem R2 ou exclusão por prefixo', () => {
  const files = [
    '../../src/lib/lostItemStorageCore.mjs',
    '../../src/lib/lostItemStorage.ts',
    '../../src/pages/RegisterItem.tsx',
    '../../src/pages/ItemDetail.tsx',
    '../../src/components/items/BulkImageUploadDialog.tsx',
  ];
  const source = files.map(relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(source, /CAPABILITY_SIGNING_SECRET|service_role|refresh_token/);
  assert.doesNotMatch(source, /listObjects|\/v1\/files\/list|deleteByPrefix|removeByPrefix/);
  assert.doesNotMatch(source, /fetchImpl\([^\n]*(?:access_token|refresh_token|\$\{token\})/i);
});
