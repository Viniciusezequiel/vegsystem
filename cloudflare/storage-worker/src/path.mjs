export const SCOPES = new Set(['lost-items', 'task-attachments']);

const unsafeSegment = /(^|\/)(?:\.{1,2})(?:\/|$)/;
const controlOrSlash = /[\\\u0000-\u001f\u007f]/;

export function validateKey(key) {
  if (typeof key !== 'string' || key.length < 1 || key.length > 900) return false;
  if (key.startsWith('/') || key.endsWith('/') || key.includes('//')) return false;
  if (unsafeSegment.test(key) || controlOrSlash.test(key)) return false;
  return key.split('/').every(segment => segment.length > 0 && segment.length <= 255);
}

export function parseR2Locator(locator) {
  if (typeof locator !== 'string' || !locator.startsWith('r2/')) return null;
  const parts = locator.split('/');
  const scope = parts[1];
  const key = parts.slice(2).join('/');
  if (!SCOPES.has(scope) || !validateKey(key)) return null;
  return { scope, key, locator: `r2/${scope}/${key}` };
}

export function parseScopedRoute(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  let decoded;
  try { decoded = decodeURIComponent(encoded); } catch { return null; }
  const slash = decoded.indexOf('/');
  if (slash < 1) return null;
  const scope = decoded.slice(0, slash);
  const key = decoded.slice(slash + 1);
  if (!SCOPES.has(scope) || !validateKey(key)) return null;
  return { scope, key, locator: `r2/${scope}/${key}` };
}

export function encodedObjectPath(scope, key) {
  return `/v1/objects/${encodeURIComponent(scope)}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
