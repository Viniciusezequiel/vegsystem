import { parseStorageUrl } from '@/lib/storageUrl';

const DATA_URL_PATTERN = /^\s*data:/i;

/** Rejects inline payloads while preserving legacy values used only for display/archive. */
export function assertNoInlineLostItemImage(value: string | null | undefined): void {
  if (typeof value === 'string' && DATA_URL_PATTERN.test(value)) {
    throw new Error('A imagem deve ser enviada ao Storage; image_url não aceita conteúdo data:/Base64.');
  }
}

/**
 * Normalizes values used by new writes to the private lost-items bucket.
 * Known Supabase URLs are reduced to their object path; arbitrary URLs and
 * browser blob/data URLs are rejected.
 */
export function normalizeLostItemImagePath(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) return value;

  const trimmed = value.trim();
  if (!trimmed) return null;
  assertNoInlineLostItemImage(trimmed);

  const parsed = parseStorageUrl(trimmed);
  if (parsed) {
    if (parsed.bucket !== 'lost-items') {
      throw new Error('A imagem deve pertencer ao bucket lost-items.');
    }
    return parsed.path.replace(/^\/+/, '');
  }

  if (/^(?:https?:|blob:)/i.test(trimmed)) {
    throw new Error('image_url deve conter somente o caminho do objeto no bucket lost-items.');
  }

  return trimmed.replace(/^\/+/, '');
}

/** Returns only conservative, deletable object paths from the lost-items bucket. */
export function getDeletableLostItemImagePath(value: string | null | undefined): string | null {
  try {
    const path = normalizeLostItemImagePath(value);
    if (!path || /[\u0000-\u001f]/.test(path)) return null;
    if (path.split('/').some(segment => !segment || segment === '.' || segment === '..')) return null;
    return path;
  } catch {
    return null;
  }
}
