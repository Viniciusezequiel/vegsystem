import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LostItemStorageOccupancy = {
  campus: string | null;
  shelf: string | null;
  box: string | null;
  box_number: string | null;
  status: string | null;
};

export function useLostItemStorageOccupancy() {
  return useQuery({
    queryKey: ['lost-items-storage-occupancy'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('campus, shelf, box, box_number, status')
        .eq('status', 'available');

      if (error) throw error;
      return (data ?? []) as LostItemStorageOccupancy[];
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
