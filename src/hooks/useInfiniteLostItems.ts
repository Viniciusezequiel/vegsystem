import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from './useLostItems';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';

interface Filters {
  status?: string;
  search?: string;
  campus?: string;
  dateFrom?: string;
  dateTo?: string;
  destination?: string;
}

const PAGE_SIZE = 20;

export function useInfiniteLostItems(filters: Filters) {
  return useInfiniteQuery({
    queryKey: [
      'lost-items',
      filters?.status ?? null,
      filters?.search ?? null,
      filters?.campus ?? null,
      filters?.dateFrom ?? null,
      filters?.dateTo ?? null,
      filters?.destination ?? null,
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam as number;
      let query = supabase
        .from('lost_items')
        .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }

      if (filters.campus && filters.campus !== 'all') {
        query = query.eq('campus', filters.campus);
      }

      if (filters.dateFrom) {
        query = query.gte('found_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('found_date', filters.dateTo);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const safeData = (Array.isArray(data) ? data : []) as unknown as LostItem[];

      return {
        items: safeData,
        totalCount: typeof count === 'number' ? count : 0,
        nextPage:
          (from + PAGE_SIZE) < (count ?? 0)
            ? from + PAGE_SIZE
            : undefined,
      };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      return lastPage.nextPage ?? undefined;
    },
  });
}
