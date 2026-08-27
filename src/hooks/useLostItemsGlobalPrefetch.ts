import type { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';
import { lostItemsQueryKeys } from '@/lib/lostItemsQueryKeys';

const HOVER_FILTERS = { status: 'available' } as const;
const PAGE_SIZE = 50;

/**
 * Prefetch only the query the default Lost & Found screen will consume.
 * It runs on intentional navigation hover, never globally on unrelated routes.
 */
export function prefetchLostItemsOnHover(queryClient: ReturnType<typeof useQueryClient>) {
  const queryKey = lostItemsQueryKeys.infinite(HOVER_FILTERS);
  if (queryClient.getQueryData(queryKey)) return;

  void queryClient.prefetchInfiniteQuery({
    queryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error, count } = await supabase
        .from('lost_items')
        .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      const items = (data as unknown as LostItem[]) || [];
      const totalCount = count ?? 0;
      const hasMore = (pageParam + 1) * PAGE_SIZE < totalCount;
      return { items, nextPage: hasMore ? pageParam + 1 : undefined, totalCount };
    },
    getNextPageParam: lastPage => lastPage.nextPage,
    staleTime: 30 * 1000,
  });
}
