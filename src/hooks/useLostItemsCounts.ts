import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LOST_ITEMS_COUNT_SELECT } from '@/lib/lostItemsSelect';

interface LostItemsCounts {
  total: number;
  available: number;
  delivered: number;
  expired: number;
}

export function useLostItemsCounts() {
  return useQuery({
    queryKey: ['lost-items-counts'],
    queryFn: async (): Promise<LostItemsCounts> => {
      // Use minimal select (just id) to avoid loading large base64 image data
      // This prevents database timeouts
      const [availableResult, deliveredResult, expiredResult] = await Promise.all([
        supabase.from('lost_items').select(LOST_ITEMS_COUNT_SELECT, { count: 'exact', head: true }).eq('status', 'available'),
        supabase.from('lost_items').select(LOST_ITEMS_COUNT_SELECT, { count: 'exact', head: true }).eq('status', 'delivered'),
        supabase.from('lost_items').select(LOST_ITEMS_COUNT_SELECT, { count: 'exact', head: true }).eq('status', 'expired'),
      ]);

      const available = availableResult.count ?? 0;
      const delivered = deliveredResult.count ?? 0;
      const expired = expiredResult.count ?? 0;

      return {
        total: available + delivered + expired,
        available,
        delivered,
        expired,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}