import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from './useLostItems';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';

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
        
        // Also prefetch images for next page items
        if (items.length > 0) {
          prefetchImagesForNextPage(queryClient, items);
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

/**
 * Prefetch images for next page items in background
 */
async function prefetchImagesForNextPage(
  queryClient: ReturnType<typeof useQueryClient>,
  items: LostItem[]
) {
  // Filter items that don't have cached images
  const itemsToFetch = items.filter(item => {
    const cached = queryClient.getQueryData(['lost-item-image', item.id]);
    return cached === undefined;
  });

  if (!itemsToFetch.length) return;

  try {
    const ids = itemsToFetch.map(item => item.id);
    
    const { data, error } = await supabase
      .from('lost_items')
      .select('id, image_url')
      .in('id', ids);

    if (error) {
      console.error('Error prefetching next page images:', error);
      return;
    }

    // Cache each image result
    for (const item of data || []) {
      const imageUrl = item.image_url;
      // Only cache valid Storage URLs (not base64)
      const validUrl = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))
        ? imageUrl
        : null;
      
      queryClient.setQueryData(['lost-item-image', item.id], validUrl);
    }
  } catch (e) {
    console.error('Error in next page image prefetch:', e);
  }
}
