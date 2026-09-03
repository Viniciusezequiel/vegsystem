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
  const source = getSignatureSource(payload?.locator);
  if (source.provider !== 'r2' || source.module !== module) throw new Error('invalid_signature_locator');
  return payload.locator;
}

export function signatureDataUrlToPngBlob(value: string): Blob {
  if (getSignatureSource(value).provider !== 'inline') throw new Error('invalid_signature_data_url');
  const encoded = value.slice('data:image/png;base64,'.length);
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error('invalid_signature_base64');
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (!PNG_MAGIC.every((byte, index) => bytes[index] === byte)) throw new Error('invalid_signature_png');
  return new Blob([bytes], { type: 'image/png' });
}

export async function uploadSignatureValue(module: string, value: string | null | undefined) {
  const source = getSignatureSource(value);
  if (source.provider === 'none') return null;
  if (source.provider === 'r2' && source.module === module) return source.value;
  if (source.provider !== 'inline') throw new Error('invalid_signature_value');
  return uploadSignaturePng(module, signatureDataUrlToPngBlob(source.value));
}

const referenceFields: Record<string, Array<{ table: string; fields: string[] }>> = {
  equipment: [{ table: 'equipment_loans', fields: ['borrower_signature', 'return_signature'] }],
  lockers: [{ table: 'locker_loans', fields: ['borrower_signature', 'return_signature'] }],
  'lost-items': [
    { table: 'lost_items', fields: ['owner_signature'] },
    { table: 'lost_items_archive', fields: ['owner_signature'] },
  ],
  'process-selection': [
    { table: 'ps_event_collaborators', fields: ['signature_url'] },
    { table: 'ps_attendance_absences', fields: ['signature_url'] },
    { table: 'ps_attendance_closures', fields: ['signature_url'] },
  ],
};

export async function countSignatureReferences(module: string, locator: string) {
  const sources = referenceFields[module];
  if (!sources || getSignatureSource(locator).provider !== 'r2') throw new Error('invalid_signature_reference_check');
  let total = 0;
  for (const source of sources) {
    let query = supabase.from(source.table).select('id', { count: 'exact', head: true });
    query = source.fields.length === 1
      ? query.eq(source.fields[0], locator)
      : query.or(source.fields.map(field => `${field}.eq.${locator}`).join(','));
    const { count, error } = await query;
    if (error || count == null) throw error ?? new Error('signature_reference_count_missing');
    total += count;
  }
  return total;
}

export async function cleanupUploadedSignatureIfUnreferenced(module: string, locator: string) {
  const source = getSignatureSource(locator);
  if (source.provider !== 'r2' || source.module !== module) throw new Error('invalid_signature_cleanup_locator');
  if (await countSignatureReferences(module, locator) !== 0) return false;
  const workerUrl = String(import.meta.env.VITE_STORAGE_WORKER_URL ?? '').replace(/\/+$/, '');
  const { data, error } = await supabase.auth.getSession();
  if (!workerUrl || error || !data.session?.access_token) throw new Error('signature_cleanup_unauthorized');
  const response = await fetch(`${workerUrl}/v1/files/${locator.slice(3)}`, {
    method: 'DELETE', headers: { authorization: `Bearer ${data.session.access_token}` },
  });
  if (response.status !== 200 && response.status !== 404) throw new Error(`signature_cleanup_failed_${response.status}`);
  return true;
}

export async function submitPublicProcessSelectionSignature(linkId: string, value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) throw new Error('invalid_process_selection_participant');
  const png = signatureDataUrlToPngBlob(value);
  if (png.size > 512 * 1024) throw new Error('signature_file_too_large');
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '');
  if (!supabaseUrl || !publishableKey) throw new Error('signature_service_unavailable');
  const response = await fetch(`${supabaseUrl}/functions/v1/ps-public-signature`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'image/png', 'x-ps-link-id': linkId },
    body: png,
  });
  const payload = await response.json().catch(() => null);
  const source = getSignatureSource(payload?.locator);
  if (response.status !== 201 || source.provider !== 'r2' || source.module !== 'process-selection') {
    throw new Error(payload?.error ?? `public_signature_failed_${response.status}`);
  }
  return source.value;
}
