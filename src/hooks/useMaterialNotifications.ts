import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export function useMaterialNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingMaterialsCount = 0 } = useQuery({
    queryKey: ['pending-materials-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      // Count material requests assigned to this user that are in progress
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

  // Use realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('material-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_requests',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-materials-count', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    pendingMaterialsCount,
  };
}
