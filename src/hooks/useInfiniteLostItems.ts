import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { LostItem } from './useLostItems';

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

    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('lost_items')
        .select('*', { count: 'exact' })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const safeData = Array.isArray(data) ? data : [];

      return {
        items: safeData,
        totalCount: typeof count === 'number' ? count : 0,
        nextPage:
          (pageParam + PAGE_SIZE) < (count ?? 0)
            ? pageParam + PAGE_SIZE
            : undefined
      };
    },

    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      return lastPage.nextPage ?? undefined;
    },
  });
}
