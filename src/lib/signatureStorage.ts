import { supabase } from '@/integrations/supabase/client';
import { resolveStorageUrl } from '@/lib/storageUrl';
import { getSignatureSource, SIGNATURE_MODULES } from '@/lib/signatureStorageCore.mjs';

export { getSignatureSource, parseSignatureLocator } from '@/lib/signatureStorageCore.mjs';

const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];

function bytesToDataUrl(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

export async function resolveSignatureDataUrl(value: string | null | undefined): Promise<string | null> {
  const source = getSignatureSource(value);
  if (source.provider === 'none') return null;
  if (source.provider === 'inline') return source.value;
  if (source.provider !== 'r2') return null;
  const capabilityUrl = await resolveStorageUrl(source.value);
  if (!capabilityUrl) return null;
  try {
    const response = await fetch(capabilityUrl, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) return null;
    const contentType = (response.headers.get('content-type') ?? '').split(';', 1)[0].toLowerCase();
    if (contentType !== 'image/png') return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!PNG_MAGIC.every((byte, index) => bytes[index] === byte)) return null;
    return bytesToDataUrl(bytes);
  } catch {
    return null;
  }
}

/** Prepared for future persistence flows; SignaturePad remains unchanged for now. */
export async function uploadSignaturePng(module: string, png: Blob): Promise<string> {
  if (!SIGNATURE_MODULES.has(module) || png.type !== 'image/png') throw new Error('invalid_signature_upload');
  const workerUrl = String(import.meta.env.VITE_STORAGE_WORKER_URL ?? '').replace(/\/+$/, '');
  if (!workerUrl) throw new Error('signature_storage_unavailable');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('signature_storage_unauthorized');
  const response = await fetch(`${workerUrl}/v1/files/signatures/${encodeURIComponent(module)}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'image/png' },
    body: png,
  });
  if (!response.ok) throw new Error(`signature_upload_failed_${response.status}`);
  const payload = await response.json();
  if (getSignatureSource(payload?.locator).provider !== 'r2') throw new Error('invalid_signature_locator');
  return payload.locator;
}
