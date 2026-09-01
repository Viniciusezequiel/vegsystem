export const R2_SIGNATURE_PREFIX = 'r2/signatures/';
export const SIGNATURE_MODULES = new Set(['equipment', 'lockers', 'lost-items', 'process-selection']);

const locatorPattern = /^r2\/signatures\/(equipment|lockers|lost-items|process-selection)\/(\d{4})\/(0[1-9]|1[0-2])\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-([0-9a-f]{16})\.png$/;
const pngDataUrlPattern = /^data:image\/png;base64,[a-z0-9+/]+={0,2}$/i;

export function parseSignatureLocator(value) {
  if (typeof value !== 'string') return null;
  const match = locatorPattern.exec(value);
  if (!match) return null;
  return { locator: value, module: match[1], year: match[2], month: match[3], uuid: match[4], checksum: match[5] };
}

export function getSignatureSource(value) {
  if (value == null || value === '') return { provider: 'none', value: null };
  if (typeof value !== 'string') return { provider: 'invalid', value: null };
  if (pngDataUrlPattern.test(value)) return { provider: 'inline', value };
  const parsed = parseSignatureLocator(value);
  if (parsed) return { provider: 'r2', value, module: parsed.module };
  return { provider: 'invalid', value: null };
}

export function getSignatureDisplayState(value, expectedModule = null) {
  const source = getSignatureSource(value);
  if (source.provider === 'none') return { status: 'empty', source: null };
  if (source.provider === 'inline') return { status: 'ready', source: source.value };
  if (source.provider === 'r2' && (!expectedModule || source.module === expectedModule)) {
    return { status: 'resolving', source: null, locator: source.value };
  }
  return { status: 'error', source: null };
}

export async function preparePdfSignatureRows(rows, resolveR2Signature) {
  return Promise.all(rows.map(async row => {
    const source = getSignatureSource(row.signature_url);
    if (source.provider === 'inline' || source.provider === 'none') return row;
    if (source.provider !== 'r2') return { ...row, signature_url: null };
    const resolved = await resolveR2Signature(source.value);
    return { ...row, signature_url: getSignatureSource(resolved).provider === 'inline' ? resolved : null };
  }));
}
