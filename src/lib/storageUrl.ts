import { supabase } from '@/integrations/supabase/client';

/**
 * The lost-items bucket is private. Legacy records store the old public URL
 * (".../storage/v1/object/public/lost-items/<path>"). These helpers convert any
 * stored value into something the browser can actually render:
 *  - public/storage URLs -> short-lived signed URL
 *  - data: URLs (legacy base64) -> returned unchanged
 */

const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours (fewer signing round-trips)
const REFRESH_MARGIN_MS = 10 * 60 * 1000; // refresh 10 min before expiry

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
export async function resolveStorageUrl(
  value: string | null | undefined,
  defaultBucket = 'lost-items'
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('data:')) return value;

  // Accepts: full storage URL (any project host), or a bare object path.
  const parsed = parseStorageUrl(value)
    ?? (value.startsWith('http')
      ? null
      : { bucket: defaultBucket, path: value.replace(/^\/+/, '') });
  if (!parsed) return value;


  const key = `${parsed.bucket}/${parsed.path}`;
  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.url;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = new Promise<string | null>((resolve) => {
    enqueue(parsed.bucket, parsed.path, key, resolve);
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

/** Resolves several stored values at once, preserving input order. */
export async function resolveStorageUrls(values: (string | null | undefined)[]) {
  return Promise.all(values.map((value) => resolveStorageUrl(value)));
}

/* ---------------------------------------------------------------------------
 * Batched signing: many components ask for URLs at the same time (lists with
 * dozens of images). Signing one-by-one floods the storage API and makes
 * images fail to load, so requests are grouped per bucket.
 * ------------------------------------------------------------------------ */

const BATCH_WINDOW_MS = 40;
const MAX_BATCH_SIZE = 50;

type QueueItem = { path: string; key: string; resolve: (url: string | null) => void };
const queues = new Map<string, QueueItem[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function enqueue(bucket: string, path: string, key: string, resolve: (url: string | null) => void) {
  const queue = queues.get(bucket) ?? [];
  queue.push({ path, key, resolve });
  queues.set(bucket, queue);

  if (queue.length >= MAX_BATCH_SIZE) {
    const timer = timers.get(bucket);
    if (timer) clearTimeout(timer);
    timers.delete(bucket);
    void flush(bucket);
    return;
  }

  if (!timers.has(bucket)) {
    timers.set(
      bucket,
      setTimeout(() => {
        timers.delete(bucket);
        void flush(bucket);
      }, BATCH_WINDOW_MS)
    );
  }
}

async function flush(bucket: string) {
  const queue = queues.get(bucket);
  if (!queue || queue.length === 0) return;
  queues.set(bucket, []);

  const batch = queue.slice(0, MAX_BATCH_SIZE);
  const rest = queue.slice(MAX_BATCH_SIZE);
  if (rest.length) {
    queues.set(bucket, rest);
    setTimeout(() => void flush(bucket), 0);
  }

  const paths = batch.map((item) => item.path);

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      batch.forEach((item) => item.resolve(null));
      return;
    }

    const byPath = new Map<string, string>();
    for (const entry of data) {
      // `path` comes back exactly as requested when successful
      if (entry.signedUrl && entry.path) byPath.set(entry.path, entry.signedUrl);
    }

    const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    batch.forEach((item) => {
      const url = byPath.get(item.path) ?? null;
      if (url) signedUrlCache.set(item.key, { url, expiresAt });
      item.resolve(url);
    });
  } catch {
    batch.forEach((item) => item.resolve(null));
  }
}

