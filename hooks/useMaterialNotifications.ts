import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useMaterialNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Count for materials assigned to user
  const { data: assignedMaterialsCount = 0 } = useQuery({
    queryKey: ['assigned-materials-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { count, error } = await supabase
        .from('material_requests')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'approved', 'in_progress']);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Count for materials requested by user that have updates
  const { data: myRequestsUpdatesCount = 0 } = useQuery({
    queryKey: ['my-requests-updates-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { count, error } = await supabase
        .from('material_requests')
        .select('*', { count: 'exact', head: true })
        .eq('requester_id', user.id)
        .in('status', ['approved', 'in_progress', 'delivered']);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Realtime subscription for assigned materials
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('material-assigned-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'material_requests',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['assigned-materials-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['material-requests'] });
          
          const newData = payload.new as any;
          if (payload.old && (payload.old as any).assigned_to !== user.id) {
            toast.info('Nova solicitação de material atribuída a você', {
              description: newData.title,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'material_requests',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['assigned-materials-count', user.id] });
          const newData = payload.new as any;
          toast.info('Nova solicitação de material atribuída a você', {
            description: newData.title,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Realtime subscription for requester's own requests updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('material-requester-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'material_requests',
          filter: `requester_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['my-requests-updates-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
          
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          if (oldData?.status !== newData?.status) {
            const statusLabels: Record<string, string> = {
              approved: 'aprovada',
              rejected: 'rejeitada',
              in_progress: 'em andamento',
              delivered: 'entregue',
            };
            const statusLabel = statusLabels[newData.status] || newData.status;
            toast.info(`Sua solicitação foi ${statusLabel}`, {
              description: newData.title,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    pendingMaterialsCount: assignedMaterialsCount + myRequestsUpdatesCount,
    assignedMaterialsCount,
    myRequestsUpdatesCount,
  };
}
