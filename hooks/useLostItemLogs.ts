import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LostItem } from './useLostItems';

export interface LostItemLog {
  id: string;
  action: string;
  itemCode: string;
  itemDescription: string;
  userName: string;
  timestamp: string;
  details?: string;
}

export function useLostItemLogs() {
  return useQuery({
    queryKey: ['lost-item-logs'],
    queryFn: async () => {
      // Get all lost items to build activity logs from their data
      const { data: items, error } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const logs: LostItemLog[] = [];
      
      for (const item of items || []) {
        // Add registration log
        logs.push({
          id: `${item.id}-registered`,
          action: 'Item registrado',
          itemCode: item.code,
          itemDescription: item.description,
          userName: 'Sistema', // We don't have registered_by name stored
          timestamp: item.created_at,
          details: `${item.description} - ${item.campus}`,
        });

        // Add delivery log if delivered
        if (item.status === 'delivered' && item.delivered_at) {
          logs.push({
            id: `${item.id}-delivered`,
            action: 'Item entregue',
            itemCode: item.code,
            itemDescription: item.description,
            userName: 'Sistema',
            timestamp: item.delivered_at,
            details: `Entregue para ${item.owner_name || 'proprietário'}`,
          });
        }
      }

      // Sort by timestamp descending
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return logs;
    },
  });
}
