const TYPES = {
  'lost-items': new Map([['image/webp', 'webp']]),
  'task-attachments': new Map([
    ['image/webp', 'webp'], ['image/jpeg', 'jpg'], ['image/png', 'png'],
    ['application/pdf', 'pdf'], ['text/plain', 'txt'],
  ]),
  signatures: new Map([['image/png', 'png']]),
};

export function bucketFor(env, scope) {
  if (scope === 'lost-items' || scope === 'signatures') return env.LOST_ITEMS_BUCKET;
  return env.TASK_ATTACHMENTS_BUCKET;
}

export function objectKeyFor(scope, key) {
  return scope === 'signatures' ? `signatures/${key}` : key;
}

export function scopeEnabled(env, scope) {
  if (scope === 'lost-items') return Boolean(env.LOST_ITEMS_BUCKET);
  if (scope === 'signatures') return env.ENABLE_SIGNATURES === 'true' && Boolean(env.LOST_ITEMS_BUCKET);
  return scope === 'task-attachments'
    && env.ENABLE_TASK_ATTACHMENTS === 'true'
    && Boolean(env.TASK_ATTACHMENTS_BUCKET);
}

export function maxBytesFor(env, scope) {
  const fallback = scope === 'signatures' ? 512 * 1024 : 10 * 1024 * 1024;
  const raw = scope === 'lost-items'
    ? env.MAX_LOST_ITEM_BYTES
    : scope === 'signatures' ? env.MAX_SIGNATURE_BYTES : env.MAX_TASK_ATTACHMENT_BYTES;
  const value = Number(raw ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function extensionFor(scope, contentType) {
  return TYPES[scope]?.get(contentType.toLowerCase()) ?? null;
}

export function validMagic(contentType, bytes) {
  if (contentType === 'image/webp') return bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (contentType === 'image/png') return bytes.slice(0, 8).every((byte, index) => byte === [137,80,78,71,13,10,26,10][index]);
  if (contentType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  return contentType === 'text/plain';
}

export async function sha256Short(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...hash].slice(0, 8).map(value => value.toString(16).padStart(2, '0')).join('');
}
