import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useExternalEquipmentNotifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('external-equipment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'external_equipment_requests',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
          queryClient.invalidateQueries({ queryKey: ['pending-equipment-requests-count'] });
          
          const newData = payload.new as any;
          toast.info('Nova solicitação de empréstimo externo', {
            description: `${newData.requester_name} solicitou ${newData.equipment_name}`,
            duration: 5000,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'external_equipment_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
          queryClient.invalidateQueries({ queryKey: ['pending-equipment-requests-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);
}

export function usePendingExternalEquipmentCount() {
  const { user } = useAuth();

  return {
    queryKey: ['pending-equipment-requests-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('external_equipment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
  };
}
