const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function signature(secret, scope, key, expiresAt) {
  if (typeof secret !== 'string' || new TextEncoder().encode(secret).length < 32) {
    throw new Error('invalid_capability_secret');
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const payload = `read\n${scope}\n${key}\n${expiresAt}`;
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(payload))));
}

export async function createCapability(secret, scope, key, expiresAt) {
  return { exp: expiresAt, sig: await signature(secret, scope, key, expiresAt) };
}

export async function verifyCapability(secret, scope, key, expValue, sig, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || !/^\d{10}$/.test(expValue ?? '') || typeof sig !== 'string') return false;
  const expiresAt = Number(expValue);
  if (expiresAt < nowSeconds || expiresAt > nowSeconds + 900) return false;
  return timingSafeEqual(await signature(secret, scope, key, expiresAt), sig);
}
