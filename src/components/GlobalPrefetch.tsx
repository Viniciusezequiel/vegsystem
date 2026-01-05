import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';
import {
  loadLostItemsFromCache,
  loadCountsFromCache,
  loadImagesFromCache,
  saveLostItemsToCache,
  saveCountsToCache,
  saveImagesToCache,
} from '@/lib/lostItemsCache';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';
import { setImagePrefetchProgress, resetImagePrefetchProgress } from '@/hooks/useImagePrefetchProgress';

const DEFAULT_QUERY_KEY = ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined];
const COUNTS_QUERY_KEY = ['lost-items-counts'];

// Batch size for prefetching images (to avoid overwhelming the database)
const IMAGE_PREFETCH_BATCH_SIZE = 20;
const IMAGE_PREFETCH_DELAY_MS = 100;

/**
 * Global prefetch component that:
 * 1. Immediately restores cached data from localStorage (instant UI)
 * 2. Prefetches fresh data in the background
 * 3. Prefetches images for all items in batches
 * 4. Saves fresh data back to localStorage for next visit
 */
export function GlobalPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // STEP 1: Instantly restore cached data for immediate UI
    const cachedItems = loadLostItemsFromCache();
    const cachedCounts = loadCountsFromCache();
    const cachedImages = loadImagesFromCache();

    if (cachedItems) {
      queryClient.setQueryData(DEFAULT_QUERY_KEY, cachedItems);
    }

    if (cachedCounts) {
      queryClient.setQueryData(COUNTS_QUERY_KEY, cachedCounts);
    }

    // Restore cached images to React Query
    if (cachedImages) {
      for (const [itemId, imageUrl] of Object.entries(cachedImages)) {
        queryClient.setQueryData(['lost-item-image', itemId], imageUrl);
      }
    }

    // If we have cached items but no images cache, prefetch images for cached items
    if (cachedItems && !cachedImages) {
      prefetchImagesForItems(queryClient, cachedItems.items);
    }

    // STEP 2: Fetch fresh data (ONLY when authenticated), and cache it
    const fetchFreshData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return; // don't poison cache with unauthenticated empty results

        // Fetch items and counts in parallel
        const [itemsResult, countsResult] = await Promise.all([
          supabase
            .from('lost_items')
            .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .range(0, 99),

          Promise.all([
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'available'),
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
          ]),
        ]);

        if (!itemsResult.error && itemsResult.data) {
          const items = (itemsResult.data as unknown as LostItem[]) || [];
          const itemsData = {
            items,
            totalCount: itemsResult.count ?? 0,
            page: 0,
            pageSize: 100,
            totalPages: Math.ceil((itemsResult.count ?? 0) / 100),
          };

          // Only overwrite cache with empty results if there wasn't anything cached yet.
          const hasAny = (itemsResult.count ?? 0) > 0 || (items.length ?? 0) > 0;
          if (hasAny || !cachedItems) {
            queryClient.setQueryData(DEFAULT_QUERY_KEY, itemsData);
            saveLostItemsToCache(itemsData);
          }

          // STEP 3: Prefetch images for all items in background
          prefetchImagesForItems(queryClient, items);
        }

        // Process counts
        const [availableResult, deliveredResult, expiredResult] = countsResult;
        if (!availableResult.error && !deliveredResult.error && !expiredResult.error) {
          const available = availableResult.count ?? 0;
          const delivered = deliveredResult.count ?? 0;
          const expired = expiredResult.count ?? 0;

          const countsData = {
            total: available + delivered + expired,
            available,
            delivered,
            expired,
          };

          queryClient.setQueryData(COUNTS_QUERY_KEY, countsData);
          saveCountsToCache(countsData);
        }
      } catch (e) {
        console.error('GlobalPrefetch error:', e);
      }
    };

    // Try immediately, and also when the user logs in
    fetchFreshData();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetchFreshData();
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return null;
}

/**
 * Prefetch images for a list of items in batches.
 * This runs in the background and doesn't block the UI.
 * Also saves images to localStorage for instant loading on next visit.
 * Updates progress indicator as it goes.
 */
async function prefetchImagesForItems(
  queryClient: ReturnType<typeof useQueryClient>,
  items: LostItem[]
) {
  if (!items.length) return;

  // Get item IDs that don't have cached images yet
  const itemsToFetch = items.filter(item => {
    const cached = queryClient.getQueryData(['lost-item-image', item.id]);
    return cached === undefined;
  });

  if (!itemsToFetch.length) {
    // All images already cached
    return;
  }

  // Reset and initialize progress
  resetImagePrefetchProgress();
  const totalItems = itemsToFetch.length;
  let loadedItems = 0;
  setImagePrefetchProgress(loadedItems, totalItems);

  // Split into batches
  const batches: LostItem[][] = [];
  for (let i = 0; i < itemsToFetch.length; i += IMAGE_PREFETCH_BATCH_SIZE) {
    batches.push(itemsToFetch.slice(i, i + IMAGE_PREFETCH_BATCH_SIZE));
  }

  const allFetchedImages: Record<string, string | null> = {};

  // Process batches sequentially with delay to avoid overwhelming the database
  for (const batch of batches) {
    try {
      const ids = batch.map(item => item.id);

      // Only fetch items that already have a real URL to avoid pulling huge legacy base64 strings.
      const { data, error } = await supabase
        .from('lost_items')
        .select('id, image_url')
        .in('id', ids)
        .ilike('image_url', 'http%');

      if (error) {
        console.error('Error prefetching images:', error);
        loadedItems += batch.length;
        setImagePrefetchProgress(loadedItems, totalItems);
        continue;
      }

      const byId = new Map<string, string>();
      for (const row of data || []) {
        if (row.image_url) byId.set(row.id, row.image_url);
      }

      // Cache all ids in the batch (null when missing) so the UI won't refetch repeatedly
      for (const id of ids) {
        const url = byId.get(id) ?? null;
        queryClient.setQueryData(['lost-item-image', id], url);
        allFetchedImages[id] = url;
      }

      // Update progress
      loadedItems += batch.length;
      setImagePrefetchProgress(loadedItems, totalItems);

      // Small delay before next batch
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, IMAGE_PREFETCH_DELAY_MS));
      }
    } catch (e) {
      console.error('Error in image prefetch batch:', e);
      loadedItems += batch.length;
      setImagePrefetchProgress(loadedItems, totalItems);
    }
  }

  // Save all fetched images to localStorage for instant loading on next visit
  if (Object.keys(allFetchedImages).length > 0) {
    saveImagesToCache(allFetchedImages);
  }
}
