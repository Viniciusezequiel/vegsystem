import { verifySupabaseJwt } from './auth.mjs';
import { authorizeUser, hasDatabaseReference } from './authorization.mjs';
import { createCapability, verifyCapability } from './capability.mjs';
import { corsHeaders, json, optionsResponse } from './http.mjs';
import { encodedObjectPath, parseR2Locator, parseScopedRoute, parseSignatureUploadPath, SCOPES } from './path.mjs';
import { bucketFor, extensionFor, maxBytesFor, objectKeyFor, scopeEnabled, sha256Short, validMagic } from './storage.mjs';

const defaults = { verifyJwt: verifySupabaseJwt, authorize: authorizeUser, hasReference: hasDatabaseReference };
const AI_ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const AI_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const AI_ALLOWED_STORAGE_CATEGORIES = new Set([
  'garrafas_copos',
  'material_academico',
  'pequenos_pertences_eletronicos',
  'roupas',
  'necessaire_lancheiras',
  'vasilhas_jalecos_pijamas',
  'sombrinhas',
  'documentos_valores',
  'variados',
]);

function normalizeAiText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 180);
}

function normalizeAiStringArray(value) {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .map(item => normalizeAiText(item))
    .filter(Boolean)
    .slice(0, 6);
  return cleaned.map(item => item.replace(/\s+/g, ' '));
}

function normalizeAiStorageCategory(value) {
  const text = normalizeAiText(value);
  if (!text) return null;
  const normalized = text.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return AI_ALLOWED_STORAGE_CATEGORIES.has(normalized) ? normalized : null;
}

function redactSensitiveText(value) {
  if (!value) return value;
  const text = String(value);
  if (/cpf|rg|cnh|cartao|telefone|endereco|matricula|nascimento|qr code|qrcode|conta|documento/i.test(text)) {
    return text
      .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***')
      .replace(/\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/g, '***')
      .replace(/\b\d{11,}\b/g, '***')
      .replace(/\b(?:cpf|rg|cnh|telefone|endereco|matricula|nascimento|cartao|conta)\b[^\n.]*[:\-]?\s*[^\n,.]+/gi, 'Documento pessoal');
  }
  return text;
}

function hasSensitivePersonalDataValue(value) {
  if (value === null || value === undefined) return false;
  const text = String(value);
  if (!text) return false;
  return /(?:cpf|rg|cnh|telefone|matricula|endereco|nascimento|conta|cartao|documento|qr\s*code|qrcode|e-mail|email|@\w+\.\w+)/i.test(text)
    || /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(text)
    || /\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/.test(text)
    || /(?:\d[ -]?){13,19}/.test(text.replace(/\s+/g, ''))
    || /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?){4,5}\d{4}\b/.test(text)
    || /\b\d{2}\/\d{2}\/\d{4}\b/.test(text)
    || /(\b\d{3}\b\s*){3,}/.test(text);
}

function stripSensitiveVisibleText(value) {
  const text = redactSensitiveText(value);
  if (!text || !String(text).trim()) return null;
  if (hasSensitivePersonalDataValue(text) || /^\d+\s*$/u.test(String(text).trim()) || /(?:cpf|rg|cnh|matricula|telefone|endereco|nascimento|conta|cartao|documento|qr|qrcode)/i.test(String(text))) {
    return null;
  }
  return String(text).trim();
}

function sanitizeAiPayload(raw) {
  const candidate = raw && typeof raw === 'object' ? raw : {};
  const confidenceInput = candidate.confidence;
  const confidence = Number(confidenceInput);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;

  const itemType = normalizeAiText(redactSensitiveText(candidate.item_type));
  const description = normalizeAiText(redactSensitiveText(candidate.description_suggestion));
  const primaryColor = normalizeAiText(redactSensitiveText(candidate.primary_color));
  const secondaryColor = normalizeAiText(redactSensitiveText(candidate.secondary_color));
  const brand = normalizeAiText(redactSensitiveText(candidate.brand));
  const material = normalizeAiText(redactSensitiveText(candidate.material));
  const features = normalizeAiStringArray(candidate.features).map(value => stripSensitiveVisibleText(value) ?? '').filter(Boolean);
  const condition = normalizeAiText(redactSensitiveText(candidate.condition));
  const category = normalizeAiStorageCategory(candidate.storage_category);
  const visibleText = normalizeAiStringArray(candidate.visible_text_safe)
    .map(value => stripSensitiveVisibleText(value))
    .filter(Boolean);
  const safeConfidence = Math.min(1, Math.max(0, confidence));

  const sensitive = [itemType, description, primaryColor, secondaryColor, brand, material, condition].some(value => hasSensitivePersonalDataValue(value));
  const shouldStripVisibleText = category === 'documentos_valores' || sensitive || /documento|cartao|identidade|cpf|rg|cnh/i.test(String(itemType ?? ''));

  const sanitizedDescription = description ? redactSensitiveText(description).trim() || null : null;

  return {
    item_type: itemType,
    description_suggestion: sanitizedDescription,
    primary_color: primaryColor,
    secondary_color: secondaryColor,
    brand: brand,
    material: material,
    features,
    condition: condition,
    storage_category: category,
    visible_text_safe: shouldStripVisibleText ? [] : visibleText.slice(0, 4),
    confidence: safeConfidence,
  };
}

function toDataUrl(bytes, contentType) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index]);
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function extractAiResponsePayload(modelResponse) {
  if (modelResponse && typeof modelResponse === 'object') {
    if (modelResponse.response !== undefined) {
      const response = modelResponse.response;
      if (typeof response === 'string') {
        try {
          const parsed = JSON.parse(response);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      if (response && typeof response === 'object') return response;
    }
    if (modelResponse.result !== undefined) {
      const result = modelResponse.result;
      if (typeof result === 'string') {
        try {
          const parsed = JSON.parse(result);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      if (result && typeof result === 'object') return result;
    }
    if (modelResponse.answer !== undefined) {
      const answer = modelResponse.answer;
      if (typeof answer === 'string') {
        try {
          const parsed = JSON.parse(answer);
          return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
          return null;
        }
      }
      if (answer && typeof answer === 'object') return answer;
    }
    return modelResponse;
  }
  if (typeof modelResponse === 'string') {
    try {
      const parsed = JSON.parse(modelResponse);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function hasLostItemCreatePermission(auth, env, fetchImpl = fetch) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return true;
  if (typeof fetchImpl !== 'function') return true;

  let response;
  try {
    response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/has_permission`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${auth.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ _user_id: auth.sub, _module: 'lostAndFound', _action: 'create' }),
    });
  } catch {
    return true;
  }

  if (!response.ok) {
    if (response.status === 403) return false;
    return true;
  }

  const payload = await response.json().catch(() => null);
  if (typeof payload === 'boolean') return payload;
  if (Array.isArray(payload) && payload.length > 0) {
    const row = payload[0];
    if (typeof row === 'boolean') return row;
    return Boolean(row?.has_permission ?? row?.result ?? row?.value ?? row?.allowed ?? row?.permission ?? false);
  }
  if (payload && typeof payload === 'object') {
    const value = payload.has_permission ?? payload.result ?? payload.value ?? payload.allowed ?? payload.permission;
    return Boolean(value);
  }
  return false;
}

async function authorizeLostItemAi(auth, env, deps, fetchImpl = fetch) {
  if (deps && typeof deps.authorize === 'function') {
    try {
      const allowed = await deps.authorize(auth, env, 'lost-found-create');
      if (allowed === false) return false;
      if (allowed === true) {
        return await hasLostItemCreatePermission(auth, env, fetchImpl);
      }
    } catch {
      // fall through to direct permission RPC below
    }
  }
  return hasLostItemCreatePermission(auth, env, fetchImpl);
}

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
  if (scope === 'signatures') return json({ locator, size: bytes.length, content_type: contentType, checksum_short: checksum }, 201, corsHeaders(request, env));
  return json({ locator, size: bytes.length, content_type: contentType, checksum_short: checksum }, 201, corsHeaders(request, env));
}

function internalPsAuthorized(request, env) {
  const provided = request.headers.get('x-ps-signature-secret') ?? '';
  const expected = env.PS_SIGNATURE_INTERNAL_SECRET ?? '';
  return expected.length >= 32 && provided.length === expected.length && provided === expected;
}

async function internalProcessSelection(request, env, context) {
  if (!internalPsAuthorized(request, env) || !scopeEnabled(env, 'signatures')) {
    return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  }
  if (request.method === 'POST') return uploadFile(request, env, context, null, 'signatures', 'process-selection');
  if (request.method !== 'DELETE') return json({ error: 'method_not_allowed' }, 405, corsHeaders(request, env));
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400, corsHeaders(request, env)); }
  const route = parseR2Locator(body?.locator);
  if (!route || route.scope !== 'signatures' || !route.key.startsWith('process-selection/')) {
    return json({ error: 'invalid_locator' }, 400, corsHeaders(request, env));
  }
  const bucket = bucketFor(env, route.scope);
  const storageKey = objectKeyFor(route.scope, route.key);
  if (!await bucket.head(storageKey)) return json({ error: 'not_found' }, 404, corsHeaders(request, env));
  await bucket.delete(storageKey);
  if (await bucket.head(storageKey)) return json({ error: 'delete_verification_failed' }, 502, corsHeaders(request, env));
  return json({ deleted: true, locator: route.locator }, 200, corsHeaders(request, env));
}

async function handleLostItemAi(request, env, deps) {
  let auth;
  try { auth = await deps.verifyJwt(request, env); }
  catch { return json({ error: 'unauthorized' }, 401, corsHeaders(request, env)); }
  try {
    const allowed = await authorizeLostItemAi(auth, env, deps);
    if (!allowed) return json({ error: 'forbidden' }, 403, corsHeaders(request, env));
  } catch {
    return json({ error: 'authorization_unavailable' }, 503, corsHeaders(request, env));
  }

  const contentType = (request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!AI_ALLOWED_CONTENT_TYPES.has(contentType)) return json({ error: 'unsupported_media_type' }, 415, corsHeaders(request, env));
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 1 || bytes.length > AI_MAX_IMAGE_BYTES) return json({ error: 'file_too_large' }, 413, corsHeaders(request, env));
  if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'ai_unavailable', code: 'AI_UNAVAILABLE' }, 503, corsHeaders(request, env));

  let aiPayload;
  try {
    const modelResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      image: toDataUrl(bytes, contentType),
      prompt: 'Analise esta imagem de um item perdido ou achado. Seja conservador e responda somente em JSON estrito com as chaves: item_type, description_suggestion, primary_color, secondary_color, brand, material, features, condition, storage_category, visible_text_safe, confidence. Nao inclua nome de pessoa, campus, local, data, contato, codigo, caixa, estante ou prateleira. Proibido transcrever CPF, RG, CNH, telefone, endereco, data de nascimento, matrículas, QR codes, cartões ou contas. Se houver documento pessoal, remova visible_text_safe. Mantenha respostas curtas e em português do Brasil. Use null quando não tiver certeza. O JSON deve ser válido e nenhum campo extra pode aparecer.',
      temperature: 0.1,
      max_tokens: 180,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lost_item_ai_response',
          schema: {
            type: 'object',
            properties: {
              item_type: { type: ['string', 'null'] },
              description_suggestion: { type: ['string', 'null'] },
              primary_color: { type: ['string', 'null'] },
              secondary_color: { type: ['string', 'null'] },
              brand: { type: ['string', 'null'] },
              material: { type: ['string', 'null'] },
              features: { type: 'array', items: { type: 'string' } },
              condition: { type: ['string', 'null'] },
              storage_category: { type: ['string', 'null'] },
              visible_text_safe: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'number' },
            },
            required: ['item_type', 'description_suggestion', 'primary_color', 'secondary_color', 'brand', 'material', 'features', 'condition', 'storage_category', 'visible_text_safe', 'confidence'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });
    const raw = extractAiResponsePayload(modelResponse);
    aiPayload = sanitizeAiPayload(raw);
  } catch (error) {
    const message = String(error?.message || error || '');
    if (/429|daily|quota|limit/i.test(message)) return json({ error: 'ai_daily_limit', code: 'AI_DAILY_LIMIT' }, 429, corsHeaders(request, env));
    if (/timeout|unavailable|capacity|not ready|model/i.test(message)) return json({ error: 'ai_unavailable', code: 'AI_UNAVAILABLE' }, 503, corsHeaders(request, env));
    return json({ error: 'ai_invalid_response', code: 'AI_INVALID_RESPONSE' }, 422, corsHeaders(request, env));
  }

  if (!aiPayload || typeof aiPayload !== 'object') return json({ error: 'ai_invalid_response', code: 'AI_INVALID_RESPONSE' }, 422, corsHeaders(request, env));
  if (!Number.isFinite(aiPayload.confidence) || aiPayload.confidence < 0 || aiPayload.confidence > 1) {
    aiPayload.confidence = 0;
  }
  return json(aiPayload, 200, corsHeaders(request, env));
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
      if (pathname === '/v1/internal/signatures/process-selection') return internalProcessSelection(request, env, context);
      if (request.method === 'POST' && pathname === '/v1/ai/lost-item') return handleLostItemAi(request, env, deps);
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
