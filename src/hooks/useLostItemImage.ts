import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { loadImagesFromCache, saveImagesToCache } from '@/lib/lostItemsCache';
import { getDeletableLostItemImagePath } from '@/lib/lostItemImageValue';
import { lostItemsQueryKeys } from '@/lib/lostItemsQueryKeys';

/**
 * Fetches image_url for a single lost item.
 * This is a lightweight query that loads images separately from the main list,
 * preventing database timeouts caused by large base64 data.
 */
export function useLostItemImage(itemId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: lostItemsQueryKeys.image(itemId),
    queryFn: async () => {
      if (!itemId) return null;
      
      const { data, error } = await supabase
        .from('lost_items')
        .select('image_url')
        .eq('id', itemId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching item image:', error);
        throw error;
      }

      const path = getDeletableLostItemImagePath(data?.image_url);
      saveImagesToCache({ [itemId]: path });
      return path;
    },
    initialData: () => itemId ? loadImagesFromCache()?.[itemId] : undefined,
    enabled: enabled && !!itemId,
    staleTime: 10 * 60 * 1000, // 10 minutes - images don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
    retryDelay: (attempt) =>
      Math.min(500 * 2 ** attempt, 3000),
  });
}
