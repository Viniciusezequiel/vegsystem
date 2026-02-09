import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from './useLostItems';
import { LOST_ITEMS_LIST_SELECT, LOST_ITEMS_COUNT_SELECT } from '@/lib/lostItemsSelect';

/**
 * Global prefetch hook that preloads lost items data when the user
 * is on the dashboard or navigates to the system. This makes the
 * lost items page load instantly.
 */
export function useLostItemsGlobalPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch the default view (available items, first page)
    const prefetchDefaultView = async () => {
      // Check if data is already cached
      const existingData = queryClient.getQueryData(['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined]);
      if (existingData) return;

      queryClient.prefetchQuery({
        queryKey: ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined],
        queryFn: async () => {
          const { data, error, count } = await supabase
            .from('lost_items')
            .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .range(0, 99);
          
          if (error) throw error;
          
          return {
            items: (data as unknown as LostItem[]) || [],
            totalCount: count ?? 0,
            page: 0,
            pageSize: 100,
            totalPages: Math.ceil((count ?? 0) / 100),
          };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    };

    // Run prefetch with a small delay to not block initial render
    const timer = setTimeout(prefetchDefaultView, 100);
    return () => clearTimeout(timer);
  }, [queryClient]);
}

/**
 * Prefetch on hover - call this when user hovers over lost items menu
 */
export function prefetchLostItemsOnHover(queryClient: ReturnType<typeof useQueryClient>) {
  const existingData = queryClient.getQueryData(['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined]);
  if (existingData) return;

  queryClient.prefetchQuery({
    queryKey: ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('lost_items')
        .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .range(0, 99);
      
      if (error) throw error;
      
      return {
        items: (data as unknown as LostItem[]) || [],
        totalCount: count ?? 0,
        page: 0,
        pageSize: 100,
        totalPages: Math.ceil((count ?? 0) / 100),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
