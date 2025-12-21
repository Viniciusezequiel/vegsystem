import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';

/**
 * Global prefetch component that preloads critical data on app initialization.
 * This ensures instant loading when users navigate to data-heavy pages.
 */
export function GlobalPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Start prefetching immediately when the app loads
    const prefetchCriticalData = async () => {
      // Prefetch lost items (default view - available items, first page)
      queryClient.prefetchQuery({
        queryKey: ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined],
        queryFn: async () => {
          const { data, error, count } = await supabase
            .from('lost_items')
            .select('*', { count: 'exact' })
            .eq('status', 'available')
            .order('created_at', { ascending: false })
            .range(0, 99);
          
          if (error) throw error;
          
          return {
            items: (data || []) as LostItem[],
            totalCount: count ?? 0,
            page: 0,
            pageSize: 100,
            totalPages: Math.ceil((count ?? 0) / 100),
          };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      // Also prefetch count for each status (for badges)
      queryClient.prefetchQuery({
        queryKey: ['lost-items-counts'],
        queryFn: async () => {
          const [availableResult, deliveredResult, expiredResult] = await Promise.all([
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'available'),
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
            supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
          ]);
          
          return {
            available: availableResult.count ?? 0,
            delivered: deliveredResult.count ?? 0,
            expired: expiredResult.count ?? 0,
          };
        },
        staleTime: 5 * 60 * 1000,
      });
    };

    // Execute immediately - no delay
    prefetchCriticalData();
  }, [queryClient]);

  return null; // This component doesn't render anything
}
