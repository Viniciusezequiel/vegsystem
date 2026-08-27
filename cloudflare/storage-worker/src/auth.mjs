const jwksCache = new Map();

function decodePart(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return new Uint8Array([...binary].map(char => char.charCodeAt(0)));
}

function decodeJson(value) {
  return JSON.parse(new TextDecoder().decode(decodePart(value)));
}

export function bearerToken(request) {
  const value = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(value);
  return match?.[1] ?? null;
}

export function validateClaims(payload, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== issuer || !audience.includes('authenticated')) throw new Error('invalid_claims');
  if (!payload.sub || !payload.session_id || payload.role !== 'authenticated') throw new Error('invalid_claims');
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) throw new Error('expired_token');
  if (Number.isFinite(payload.nbf) && payload.nbf > nowSeconds + 30) throw new Error('invalid_claims');
  return { sub: payload.sub, sessionId: payload.session_id, exp: payload.exp, token: payload.__token };
}

async function loadJwk(env, kid, fetchImpl) {
  const cacheKey = `${env.SUPABASE_URL}|${kid}`;
  const cached = jwksCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.key;
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('jwks_unavailable');
  const document = await response.json();
  const jwk = document.keys?.find(candidate => candidate.kid === kid && candidate.kty === 'EC' && candidate.alg === 'ES256' && candidate.use !== 'enc');
  if (!jwk) throw new Error('unknown_key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  jwksCache.set(cacheKey, { key, expiresAt: Date.now() + 10 * 60_000 });
  return key;
}

export async function verifySupabaseJwt(request, env, fetchImpl = fetch) {
  const token = bearerToken(request);
  if (!token) throw new Error('missing_token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid_token');
  let header;
  let payload;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
  } catch { throw new Error('invalid_token'); }
  if (header.alg !== 'ES256' || typeof header.kid !== 'string') throw new Error('invalid_algorithm');
  const key = await loadJwk(env, header.kid, fetchImpl);
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' }, key, decodePart(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new Error('invalid_signature');
  payload.__token = token;
  return validateClaims(payload, env);
}
