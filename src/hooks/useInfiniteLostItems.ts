import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';
import { loadLostItemsFromCache } from '@/lib/lostItemsCache';
import type { Database } from '@/integrations/supabase/types';
import { LostItem } from './useLostItems';
import { lostItemsQueryKeys } from '@/lib/lostItemsQueryKeys';
import {
  matchesSmartLostItemOffline,
  smartSearchLostItems,
} from '@/lib/lostItemSmartSearch';

type CampusEnum = Database['public']['Enums']['campus_enum'];

export interface InfiniteFilters {
  status?: string;
  search?: string;
  campus?: CampusEnum | 'all';
  dateFrom?: string;
  dateTo?: string;
  destination?: 'all' | 'donation' | 'disposal';
}

const PAGE_SIZE = 50;

export function useInfiniteLostItems(filters?: InfiniteFilters) {
  return useInfiniteQuery({
    queryKey: lostItemsQueryKeys.infinite(filters),
    queryFn: async ({ pageParam = 0 }) => {
      // OFFLINE: serve from cache
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = loadLostItemsFromCache();
        let list = cached?.items ?? [];
        
        // Apply filters
        if (filters?.status && filters.status !== 'all') {
          list = list.filter(i => i.status === filters.status);
        }
        if (filters?.search) {
          list = list.filter((item) =>
            matchesSmartLostItemOffline(
              item,
              filters.search!
            )
          );
        }
        if (filters?.campus && filters.campus !== 'all') {
          list = list.filter(i => i.campus === filters.campus);
        }
        if (filters?.dateFrom) {
          list = list.filter(i => (i.received_date || '') >= filters.dateFrom!);
        }
        if (filters?.dateTo) {
          list = list.filter(i => (i.received_date || '') <= filters.dateTo!);
        }
        if (filters?.destination && filters.destination !== 'all') {
          if (filters.destination === 'donation') {
            list = list.filter(i => i.owner_name === 'DOAÇÃO');
          } else if (filters.destination === 'disposal') {
            list = list.filter(i => i.owner_name === 'DESCARTE');
          }
        }

        const start = pageParam * PAGE_SIZE;
        const items = list.slice(start, start + PAGE_SIZE);
        
        return {
          items,
          nextPage: items.length === PAGE_SIZE ? pageParam + 1 : undefined,
          totalCount: list.length,
        };
      }

      // Smart search: tokenized, accent-insensitive and fuzzy.
      if (filters?.search?.trim()) {
        const result = await smartSearchLostItems({
          search: filters.search,
          status: filters.status,
          campus: filters.campus,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          destination: filters.destination,
          limit: PAGE_SIZE,
          offset: pageParam * PAGE_SIZE,
        });

        const hasMore =
          (pageParam + 1) * PAGE_SIZE <
          result.totalCount;

        return {
          items: result.items,
          nextPage: hasMore
            ? pageParam + 1
            : undefined,
          totalCount: result.totalCount,
        };
      }

      // Build query
      let query = supabase
        .from('lost_items')
        .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.campus && filters.campus !== 'all') {
        query = query.eq('campus', filters.campus);
      }

      if (filters?.dateFrom) {
        query = query.gte('received_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('received_date', filters.dateTo);
      }

      if (filters?.destination && filters.destination !== 'all') {
        if (filters.destination === 'donation') {
          query = query.eq('owner_name', 'DOAÇÃO');
        } else if (filters.destination === 'disposal') {
          query = query.eq('owner_name', 'DESCARTE');
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const items = (data as unknown as LostItem[]) || [];
      const totalCount = count ?? 0;
      const hasMore = (pageParam + 1) * PAGE_SIZE < totalCount;

      return {
        items,
        nextPage: hasMore ? pageParam + 1 : undefined,
        totalCount,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
