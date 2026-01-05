import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches image_url for a single lost item.
 * This is a lightweight query that loads images separately from the main list,
 * preventing database timeouts caused by large base64 data.
 */
export function useLostItemImage(itemId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lost-item-image', itemId],
    queryFn: async () => {
      if (!itemId) return null;
      
      const { data, error } = await supabase
        .from('lost_items')
        .select('image_url')
        .eq('id', itemId)
        .single();
      
      if (error) {
        console.error('Error fetching item image:', error);
        return null;
      }
      
      const imageUrl = data?.image_url;
      
      // Only return valid Storage URLs (not base64)
      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        return imageUrl;
      }
      
      return null;
    },
    enabled: enabled && !!itemId,
    staleTime: 10 * 60 * 1000, // 10 minutes - images don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}
