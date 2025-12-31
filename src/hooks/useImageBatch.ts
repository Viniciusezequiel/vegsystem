import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global cache for image URLs
const imageCache = new Map<string, string | null>();

// Batch queue for pending requests
let pendingIds: Set<string> = new Set();
let batchTimeout: ReturnType<typeof setTimeout> | null = null;
let batchPromise: Promise<void> | null = null;
const listeners = new Map<string, Set<(url: string | null) => void>>();

// Max batch size to avoid timeout (image_url can be large base64)
const MAX_BATCH_SIZE = 5;

// Fetch a single small batch
async function fetchSmallBatch(ids: string[]) {
  try {
    const { data, error } = await supabase
      .from('lost_items')
      .select('id, image_url')
      .in('id', ids);
    
    if (error) throw error;
    
    const resultMap = new Map(data?.map(item => [item.id, item.image_url]) || []);
    
    ids.forEach(id => {
      const url = resultMap.get(id) ?? null;
      imageCache.set(id, url);
      
      const idListeners = listeners.get(id);
      if (idListeners) {
        idListeners.forEach(callback => callback(url));
        listeners.delete(id);
      }
    });
  } catch (e) {
    console.error('Error fetching image batch:', e);
    ids.forEach(id => {
      imageCache.set(id, null);
      const idListeners = listeners.get(id);
      if (idListeners) {
        idListeners.forEach(callback => callback(null));
        listeners.delete(id);
      }
    });
  }
}

// Fetch images in small batches to avoid timeout
async function fetchBatch() {
  if (pendingIds.size === 0) return;
  
  const idsToFetch = Array.from(pendingIds);
  pendingIds = new Set();
  batchTimeout = null;
  
  // Split into small chunks and fetch in parallel
  const chunks: string[][] = [];
  for (let i = 0; i < idsToFetch.length; i += MAX_BATCH_SIZE) {
    chunks.push(idsToFetch.slice(i, i + MAX_BATCH_SIZE));
  }
  
  // Fetch all chunks in parallel
  await Promise.all(chunks.map(chunk => fetchSmallBatch(chunk)));
}

// Queue an id for batch fetching
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
      batchPromise = fetchBatch();
    }, 50);
  }
}

/**
 * Hook for efficient batched image loading
 * Groups multiple image requests into a single query
 */
export function useBatchedImage(itemId: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    // Check cache on init
    if (itemId && imageCache.has(itemId)) {
      return imageCache.get(itemId)!;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!imageCache.has(itemId || ''));
  const requestedRef = useRef(false);

  const requestImage = useCallback(() => {
    if (!itemId || requestedRef.current) return;
    requestedRef.current = true;
    
    // Check cache first
    if (imageCache.has(itemId)) {
      setImageUrl(imageCache.get(itemId)!);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    queueImageFetch(itemId, (url) => {
      setImageUrl(url);
      setIsLoading(false);
    });
  }, [itemId]);

  return { imageUrl, isLoading, requestImage };
}

/**
 * Prefetch images for a list of item IDs
 */
export function prefetchImages(itemIds: string[]) {
  const uncachedIds = itemIds.filter(id => !imageCache.has(id));
  if (uncachedIds.length === 0) return;
  
  uncachedIds.forEach(id => pendingIds.add(id));
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      batchPromise = fetchBatch();
    }, 50);
  }
}
