import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useTaskNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const initialLoadDone = useRef(false);

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
    staleTime: 60000,
  });

  // Realtime subscription with popup notification for new assignments
  useEffect(() => {
    if (!user?.id) return;

    // Wait a moment to avoid firing on initial load
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 3000);

    const channel = supabase
      .channel('task-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          if (initialLoadDone.current) {
            const task = payload.new as { title?: string; created_by_name?: string; priority?: string };
            toast.info('📋 Nova demanda atribuída a você!', {
              description: `${task.title || 'Sem título'} — criada por ${task.created_by_name || 'Sistema'}`,
              duration: 8000,
              action: {
                label: 'Ver',
                onClick: () => {
                  queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
                },
              },
            });
          }
          queryClient.invalidateQueries({ queryKey: ['pending-tasks-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pending-tasks-count', user.id] });
          queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Listen for tasks newly assigned TO this user (UPDATE that changes assigned_to)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('task-reassign-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          const newData = payload.new as { assigned_to?: string; title?: string; created_by_name?: string };
          const oldData = payload.old as { assigned_to?: string };
          
          // If assigned_to changed TO this user
          if (newData.assigned_to === user.id && oldData.assigned_to !== user.id && initialLoadDone.current) {
            toast.info('📋 Nova demanda atribuída a você!', {
              description: `${newData.title || 'Sem título'}`,
              duration: 8000,
            });
            queryClient.invalidateQueries({ queryKey: ['pending-tasks-count', user.id] });
            queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
          }
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
