import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeUser, hasDatabaseReference } from '../src/authorization.mjs';

const env = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-key' };
const auth = { sub: 'validated-sub', sessionId: `session-${crypto.randomUUID()}`, token: 'jwt' };

test('autorização usa exclusivamente o sub validado', async () => {
  let received;
  let calledUrl;
  const fetchMock = async (url, init) => {
    calledUrl = String(url);
    received = JSON.parse(init.body);
    return new Response('{"internal":true,"roles":["assistente"]}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  assert.equal(await authorizeUser(auth, env, 'upload', fetchMock), true);
  assert.match(calledUrl, /\/rpc\/get_my_storage_access$/);
  assert.deepEqual(received, {});
});

test('roles autorizam DELETE sem confiar em role fornecida pelo cliente', async () => {
  async function decision(roles, suffix) {
    const scopedAuth = { ...auth, sessionId: `${auth.sessionId}-${suffix}` };
    const fetchMock = async () => new Response(JSON.stringify({ internal: roles.length > 0, roles }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
    return authorizeUser(scopedAuth, env, 'delete', fetchMock);
  }
  assert.equal(await decision(['assistente'], 'assistant'), true);
  assert.equal(await decision(['admin'], 'admin'), true);
  assert.equal(await decision([], 'no-role'), false);
});

test('checagem de referências consulta as duas tabelas e falha fechada', async () => {
  const urls = [];
  const fetchMock = async url => {
    urls.push(String(url));
    return new Response(url.toString().includes('lost_items_archive') ? '[{"id":"x"}]' : '[]', {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  assert.equal(await hasDatabaseReference(auth, env, 'lost-items', 'r2/lost-items/a.webp', fetchMock), true);
  assert.equal(urls.length, 2);
  assert.ok(urls.every(url => url.includes('image_url=eq.')));
  assert.equal(await hasDatabaseReference(auth, env, 'task-attachments', 'r2/task-attachments/a.pdf', fetchMock), false);
  assert.ok(urls.at(-1).includes('task_comments'));
  assert.ok(urls.at(-1).includes('attachment_urls=cs.'));
});
