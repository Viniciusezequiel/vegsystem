import { verifySupabaseJwt } from './auth.mjs';
import { authorizeUser, hasDatabaseReference } from './authorization.mjs';
import { createCapability, verifyCapability } from './capability.mjs';
import { corsHeaders, json, optionsResponse } from './http.mjs';
import { encodedObjectPath, parseR2Locator, parseScopedRoute, parseSignatureUploadPath, SCOPES } from './path.mjs';
import { bucketFor, extensionFor, maxBytesFor, objectKeyFor, scopeEnabled, sha256Short, validMagic } from './storage.mjs';

const defaults = { verifyJwt: verifySupabaseJwt, authorize: authorizeUser, hasReference: hasDatabaseReference };

function authenticated(deps, operation, handler) {
  return async (request, env, context) => {
    let auth;
    try { auth = await deps.verifyJwt(request, env); }
    catch { return json({ error: 'unauthorized' }, 401, corsHeaders(request, env)); }
    try {
      if (!await deps.authorize(auth, env, operation)) return json({ error: 'forbidden' }, 403, corsHeaders(request, env));
    } catch { return json({ error: 'authorization_unavailable' }, 503, corsHeaders(request, env)); }
    return handler(request, env, context, auth);
  };
}

async function resolveFiles(request, env, _context, auth, deps) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, corsHeaders(request, env)); }
  if (!Array.isArray(body.locators) || body.locators.length < 1 || body.locators.length > 50) {
    return json({ error: 'invalid_locators' }, 400, corsHeaders(request, env));
  }
  const parsed = body.locators.map(parseR2Locator);
  if (parsed.some(value => !value)) return json({ error: 'invalid_locator' }, 400, corsHeaders(request, env));
  if (parsed.some(value => !scopeEnabled(env, value.scope))) {
    return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  }
  for (const item of parsed) {
    if (item.scope !== 'signatures') continue;
    let referenced;
    try { referenced = await deps.hasReference(auth, env, item.scope, item.locator); }
    catch { return json({ error: 'reference_check_unavailable' }, 503, corsHeaders(request, env)); }
    if (!referenced) return json({ error: 'forbidden' }, 403, corsHeaders(request, env));
  }
  const ttl = Math.min(900, Math.max(30, Number(env.FILE_URL_TTL_SECONDS ?? 300)));
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const origin = new URL(request.url).origin;
  const files = await Promise.all(parsed.map(async item => {
    const capability = await createCapability(env.CAPABILITY_SIGNING_SECRET, item.scope, item.key, expiresAt);
    const url = new URL(encodedObjectPath(item.scope, item.key), origin);
    url.searchParams.set('exp', String(capability.exp));
    url.searchParams.set('sig', capability.sig);
    return { locator: item.locator, url: url.toString(), expires_at: expiresAt };
  }));
  return json({ files }, 200, { ...corsHeaders(request, env), 'cache-control': 'no-store' });
}

async function readObject(request, env, route) {
  if (!scopeEnabled(env, route.scope)) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  const url = new URL(request.url);
  if (!await verifyCapability(env.CAPABILITY_SIGNING_SECRET, route.scope, route.key, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
    return json({ error: 'invalid_or_expired_capability' }, 403, corsHeaders(request, env));
  }
  const bucket = bucketFor(env, route.scope);
  const storageKey = objectKeyFor(route.scope, route.key);
  const object = request.method === 'HEAD' ? await bucket.head(storageKey) : await bucket.get(storageKey);
  if (!object) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata?.(headers);
  headers.set('etag', object.httpEtag ?? `"${object.etag}"`);
  headers.set('content-length', String(object.size));
  headers.set('cache-control', 'private, max-age=300');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "default-src 'none'; sandbox");
  if (route.scope === 'lost-items' || route.scope === 'signatures') headers.set('content-disposition', 'inline');
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

async function uploadFile(request, env, _context, auth, scope, module = null) {
  const contentType = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  const extension = extensionFor(scope, contentType);
  if (!extension) return json({ error: 'unsupported_media_type' }, 415, corsHeaders(request, env));
  const declared = Number(request.headers.get('content-length'));
  const limit = maxBytesFor(env, scope);
  if (Number.isFinite(declared) && declared > limit) return json({ error: 'file_too_large' }, 413, corsHeaders(request, env));
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 1 || bytes.length > limit) return json({ error: 'file_too_large' }, 413, corsHeaders(request, env));
  if (!validMagic(contentType, bytes)) return json({ error: 'invalid_file_signature' }, 415, corsHeaders(request, env));
  const checksum = await sha256Short(bytes);
  const date = new Date();
  const datedKey = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${checksum}.${extension}`;
  const key = module ? `${module}/${datedKey}` : datedKey;
  const storageKey = objectKeyFor(scope, key);
  const bucket = bucketFor(env, scope);
  if (await bucket.head(storageKey)) return json({ error: 'key_collision' }, 409, corsHeaders(request, env));
  await bucket.put(storageKey, bytes, {
    httpMetadata: { contentType, cacheControl: 'private, max-age=300' },
    customMetadata: { sha256_short: checksum },
  });
  const stored = await bucket.head(storageKey);
  if (!stored || stored.size !== bytes.length) return json({ error: 'upload_verification_failed' }, 502, corsHeaders(request, env));
  const locator = `r2/${scope}/${key}`;
  if (scope === 'signatures') return json({ locator }, 201, corsHeaders(request, env));
  return json({ locator, size: bytes.length, content_type: contentType, checksum_short: checksum }, 201, corsHeaders(request, env));
}

async function deleteFile(request, env, _context, auth, route, deps) {
  let referenced;
  try { referenced = await deps.hasReference(auth, env, route.scope, route.locator); }
  catch { return json({ error: 'reference_check_unavailable', preserved: true }, 503, corsHeaders(request, env)); }
  if (referenced) return json({ error: 'object_still_referenced', preserved: true }, 409, corsHeaders(request, env));
  const bucket = bucketFor(env, route.scope);
  const storageKey = objectKeyFor(route.scope, route.key);
  if (!await bucket.head(storageKey)) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  await bucket.delete(storageKey);
  if (await bucket.head(storageKey)) return json({ error: 'delete_verification_failed' }, 502, corsHeaders(request, env));
  return json({ deleted: true, locator: route.locator }, 200, corsHeaders(request, env));
}

export function createApp(overrides = {}) {
  const deps = { ...defaults, ...overrides };
  const resolve = authenticated(deps, 'read', (request, env, context, auth) => resolveFiles(request, env, context, auth, deps));
  const upload = authenticated(deps, 'upload', async (request, env, context, auth) => {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/v1/files/signatures/')) {
      const module = parseSignatureUploadPath(pathname);
      if (!module) return json({ error: 'invalid_signature_module' }, 400, corsHeaders(request, env));
      if (!scopeEnabled(env, 'signatures')) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
      return uploadFile(request, env, context, auth, 'signatures', module);
    }
    const scope = decodeURIComponent(pathname.slice('/v1/files/'.length));
    if (!SCOPES.has(scope) || scope.includes('/')) return json({ error: 'invalid_scope' }, 400, corsHeaders(request, env));
    if (!scopeEnabled(env, scope)) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
    return uploadFile(request, env, context, auth, scope);
  });
  const remove = authenticated(deps, 'delete', async (request, env, context, auth) => {
    const route = parseScopedRoute(new URL(request.url).pathname, '/v1/files/');
    if (!route) return json({ error: 'invalid_path' }, 400, corsHeaders(request, env));
    if (!scopeEnabled(env, route.scope)) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
    return deleteFile(request, env, context, auth, route, deps);
  });
  return {
    async fetch(request, env, context) {
      if (request.method === 'OPTIONS') return optionsResponse(request, env);
      const pathname = new URL(request.url).pathname;
      if (request.method === 'POST' && pathname === '/v1/files/resolve') return resolve(request, env, context);
      const objectRoute = parseScopedRoute(pathname, '/v1/objects/');
      if ((request.method === 'GET' || request.method === 'HEAD') && objectRoute) return readObject(request, env, objectRoute);
      if (request.method === 'POST' && pathname.startsWith('/v1/files/')) return upload(request, env, context);
      if (request.method === 'DELETE' && pathname.startsWith('/v1/files/')) return remove(request, env, context);
      return json({ error: 'not_found' }, 404, corsHeaders(request, env));
    },
  };
}

export default createApp();
