import { supabase } from '@/integrations/supabase/client';

/**
 * The lost-items bucket is private. Legacy records store the old public URL
 * (".../storage/v1/object/public/lost-items/<path>"). These helpers convert any
 * stored value into something the browser can actually render:
 *  - public/storage URLs -> short-lived signed URL
 *  - data: URLs (legacy base64) -> returned unchanged
 */

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

type CacheEntry = { url: string; expiresAt: number };
const signedUrlCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();

/** Extracts { bucket, path } from a Supabase storage URL, or null when not one. */
export function parseStorageUrl(value: string): { bucket: string; path: string } | null {
  const match = value.match(/\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/**
 * Resolves a stored image value into a renderable URL.
 * Returns null when the value is empty or the signed URL could not be created.
 */
export async function resolveStorageUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('data:')) return value;

  const parsed = parseStorageUrl(value);
  if (!parsed) return value.startsWith('http') ? value : null;

  const key = `${parsed.bucket}/${parsed.path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(parsed.bucket)
        .createSignedUrl(parsed.path, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) return null;

      signedUrlCache.set(key, {
        url: data.signedUrl,
        expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      });
      return data.signedUrl;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  return request;
}

/** Resolves several stored values at once, preserving input order. */
export async function resolveStorageUrls(values: (string | null | undefined)[]) {
  return Promise.all(values.map((value) => resolveStorageUrl(value)));
}
