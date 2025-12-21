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

    // STEP 2: Fetch fresh data in background (even if cache exists)
    const fetchFreshData = async () => {
      try {
        // Fetch items and counts in parallel
        const [itemsResult, countsResult] = await Promise.all([
          // Items query
          supabase
            .from('lost_items')
            .select('*', { count: 'exact' })
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .range(0, 99),
          
          // Counts query (all in one go for efficiency)
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
          
          // Update React Query cache
          queryClient.setQueryData(DEFAULT_QUERY_KEY, itemsData);
          
          // Persist to localStorage
          saveLostItemsToCache(itemsData);
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

    // If no cache OR cache is stale, fetch immediately
    // If cache exists and is fresh, still fetch but with slight delay to not block initial render
    if (!cachedItems || isCacheStale()) {
      fetchFreshData();
    } else {
      // Fresh cache exists - delay background refresh slightly
      const timer = setTimeout(fetchFreshData, 2000);
      return () => clearTimeout(timer);
    }
  }, [queryClient]);

  return null;
}
