import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTaskNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ['pending-tasks-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress']);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute - realtime will handle updates
  });

  // Use realtime subscription instead of polling
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('task-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-tasks-count', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return {
    pendingTasksCount,
  };
}
