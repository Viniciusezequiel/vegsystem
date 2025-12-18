import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from './useLostItems';

interface PrefetchFilters {
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useLostItemsPrefetch(filters: PrefetchFilters) {
  const queryClient = useQueryClient();
  const { status, search, page, pageSize, totalPages } = filters;

  useEffect(() => {
    // Don't prefetch if we're on the last page
    if (page >= totalPages - 1) return;

    const nextPage = page + 1;

    // Prefetch next page
    queryClient.prefetchQuery({
      queryKey: ['lost-items', status, search, nextPage, pageSize],
      queryFn: async () => {
        let query = supabase
          .from('lost_items')
          .select('*', { count: 'exact' })
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
        
        return {
          items: (data || []) as LostItem[],
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
