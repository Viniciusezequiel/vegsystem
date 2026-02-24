import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { LostItem } from './useLostItems';

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
        .select('*', { count: 'exact' })
        .range(from, from + PAGE_SIZE - 1);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,code.ilike.%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const safeData = (Array.isArray(data) ? data : []) as LostItem[];

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
