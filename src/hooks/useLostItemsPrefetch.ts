import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from './useLostItems';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';
import { getDeletableLostItemImagePath } from '@/lib/lostItemImageValue';

interface PrefetchFilters {
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Prefetch next page of items and their images when user is near end of current page.
 */
export function useLostItemsPrefetch(filters: PrefetchFilters) {
  const queryClient = useQueryClient();
  const { status, search, page, pageSize, totalPages } = filters;

  useEffect(() => {
    // Don't prefetch if we're on the last page
    if (page >= totalPages - 1) return;

    const nextPage = page + 1;

    // Prefetch next page items
    queryClient.prefetchQuery({
      queryKey: ['lost-items', status, search, nextPage, pageSize],
      queryFn: async () => {
        let query = supabase
          .from('lost_items')
          .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(nextPage * pageSize, (nextPage + 1) * pageSize - 1);

        if (status && status !== 'all') {
          query = query.eq('status', status);
        }

        if (search) {
          query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%,found_location.ilike.%${search}%`);
        }

        const { data, error, count } = await query;
        
        if (error) throw error;

        const items = (data as unknown as LostItem[]) || [];
        
        // image_url já vem como locator curto do R2 no mesmo SELECT.
        // Alimenta o cache das miniaturas sem uma segunda consulta por página.
        for (const item of items) {
          queryClient.setQueryData(
            ['lost-item-image', item.id],
            getDeletableLostItemImagePath(item.image_url),
          );
        }
        
        return {
          items,
          totalCount: count ?? 0,
          page: nextPage,
          pageSize,
          totalPages: Math.ceil((count ?? 0) / pageSize),
        };
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient, status, search, page, pageSize, totalPages]);
}
