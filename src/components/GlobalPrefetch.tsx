import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';
import {
  loadLostItemsFromCache,
  loadCountsFromCache,
  saveLostItemsToCache,
  saveCountsToCache,
  isCacheStale,
} from '@/lib/lostItemsCache';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';

const DEFAULT_QUERY_KEY = ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined];
const COUNTS_QUERY_KEY = ['lost-items-counts'];

/**
 * Global prefetch component that:
 * 1. Immediately restores cached data from localStorage (instant UI)
 * 2. Prefetches fresh data in the background
 * 3. Saves fresh data back to localStorage for next visit
 */
export function GlobalPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // STEP 1: Instantly restore cached data for immediate UI
    const cachedItems = loadLostItemsFromCache();
    const cachedCounts = loadCountsFromCache();

    if (cachedItems) {
      queryClient.setQueryData(DEFAULT_QUERY_KEY, cachedItems);
    }

    if (cachedCounts) {
      queryClient.setQueryData(COUNTS_QUERY_KEY, cachedCounts);
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

        // Process items
        if (!itemsResult.error) {
          const itemsData = {
            items: (itemsResult.data || []) as LostItem[],
            totalCount: itemsResult.count ?? 0,
            page: 0,
            pageSize: 100,
            totalPages: Math.ceil((itemsResult.count ?? 0) / 100),
          };

          // Only overwrite cache with empty results if there wasn't anything cached yet.
          const hasAny = (itemsResult.count ?? 0) > 0 || (itemsResult.data?.length ?? 0) > 0;
          if (hasAny || !cachedItems) {
            queryClient.setQueryData(DEFAULT_QUERY_KEY, itemsData);
            saveLostItemsToCache(itemsData);
          }
        }

        // Process counts
        const [availableResult, deliveredResult, expiredResult] = countsResult;
        if (!availableResult.error && !deliveredResult.error && !expiredResult.error) {
          const countsData = {
            available: availableResult.count ?? 0,
            delivered: deliveredResult.count ?? 0,
            expired: expiredResult.count ?? 0,
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
