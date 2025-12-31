import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global cache for image URLs (id -> url). If a row truly has no image, we cache null.
const imageCache = new Map<string, string | null>();

// Batch queue for pending requests
let pendingIds: Set<string> = new Set();
let batchTimeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<string, Set<(url: string | null) => void>>();

// IMPORTANT: image_url can be huge (legacy base64). Keep batches tiny so one bad row
// doesn't timeout the whole request.
const MAX_BATCH_SIZE = 1;

async function fetchOne(id: string) {
  try {
    const { data, error } = await supabase
      .from('lost_items')
      .select('id, image_url')
      .eq('id', id)
      .single();

    if (error) throw error;

    // If the DB value is null (item has no image), cache null.
    // If it's a URL/base64, cache the string.
    const url = (data?.image_url ?? null) as string | null;
    imageCache.set(id, url);

    const idListeners = listeners.get(id);
    if (idListeners) {
      idListeners.forEach((callback) => callback(url));
      listeners.delete(id);
    }
  } catch (e) {
    // Do NOT cache null here (otherwise a transient timeout becomes permanent).
    console.error('Error fetching image:', e);

    const idListeners = listeners.get(id);
    if (idListeners) {
      idListeners.forEach((callback) => callback(null));
      listeners.delete(id);
    }
  }
}

async function fetchBatch() {
  if (pendingIds.size === 0) return;

  const idsToFetch = Array.from(pendingIds);
  pendingIds = new Set();
  batchTimeout = null;

  // Small chunks, processed sequentially to avoid spiking requests
  for (let i = 0; i < idsToFetch.length; i += MAX_BATCH_SIZE) {
    const chunk = idsToFetch.slice(i, i + MAX_BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(chunk.map((id) => fetchOne(id)));
  }
}

function queueImageFetch(id: string, callback: (url: string | null) => void) {
  // If already cached, return immediately
  if (imageCache.has(id)) {
    callback(imageCache.get(id)!);
    return;
  }

  // Add to listeners
  if (!listeners.has(id)) {
    listeners.set(id, new Set());
  }
  listeners.get(id)!.add(callback);

  // Add to pending batch
  pendingIds.add(id);

  // Schedule batch fetch (debounced 50ms)
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      void fetchBatch();
    }, 50);
  }
}

/**
 * Hook for efficient image loading (with auto-fix for legacy base64 images).
 */
export function useBatchedImage(itemId: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    if (itemId && imageCache.has(itemId)) return imageCache.get(itemId)!;
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const inFlightRef = useRef(false);
  const repairAttemptedRef = useRef(false);

  const requestImage = useCallback(() => {
    if (!itemId || inFlightRef.current) return;

    // Cached path
    if (imageCache.has(itemId)) {
      setImageUrl(imageCache.get(itemId)!);
      setIsLoading(false);
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);

    queueImageFetch(itemId, (url) => {
      const cached = imageCache.has(itemId);

      // Success (including DB-null image)
      if (cached) {
        setImageUrl(imageCache.get(itemId)!);
        setIsLoading(false);
        inFlightRef.current = false;
        return;
      }

      // If we got null and it's NOT cached, it was a fetch error (e.g., statement timeout).
      // Try a one-time repair: convert base64 -> storage URL server-side, then refetch.
      if (url === null && !repairAttemptedRef.current) {
        repairAttemptedRef.current = true;

        (async () => {
          try {
            await supabase.functions.invoke('migrate-lost-item-image', {
              body: { id: itemId },
            });
          } catch (e) {
            console.error('Failed to repair lost item image:', e);
          }

          // Retry fetch once
          queueImageFetch(itemId, () => {
            setImageUrl(imageCache.get(itemId) ?? null);
            setIsLoading(false);
            inFlightRef.current = false;
          });
        })();

        return;
      }

      // Final fallback
      setImageUrl(null);
      setIsLoading(false);
      inFlightRef.current = false;
    });
  }, [itemId]);

  return { imageUrl, isLoading, requestImage };
}

/**
 * Prefetch images for a list of item IDs
 */
export function prefetchImages(itemIds: string[]) {
  const uncachedIds = itemIds.filter((id) => !imageCache.has(id));
  if (uncachedIds.length === 0) return;

  uncachedIds.forEach((id) => pendingIds.add(id));

  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      void fetchBatch();
    }, 50);
  }
}
