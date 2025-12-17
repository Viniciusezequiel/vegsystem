import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskTeamMember {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export function useTaskTeamMembers(taskId: string) {
  return useQuery({
    queryKey: ['task-team-members', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_team_members')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as TaskTeamMember[];
    },
    enabled: !!taskId,
  });
}

export function useAddTaskTeamMember() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, userId, userName }: { taskId: string; userId: string; userName: string }) => {
      const { data, error } = await supabase
        .from('task_team_members')
        .insert({
          task_id: taskId,
          user_id: userId,
          user_name: userName,
        })
        .select()
        .single();

      if (error) throw error;

      // Log to task history
      await supabase.from('task_history').insert({
        task_id: taskId,
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        action: `Adicionou ${userName} à equipe`,
      });

      return data;
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-team-members', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-history', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Membro adicionado à equipe!');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Este membro já faz parte da equipe.');
      } else {
        toast.error('Erro ao adicionar membro: ' + error.message);
      }
    },
  });
}

export function useRemoveTaskTeamMember() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, memberId, memberName }: { taskId: string; memberId: string; memberName: string }) => {
      const { error } = await supabase
        .from('task_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Log to task history
      await supabase.from('task_history').insert({
        task_id: taskId,
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        action: `Removeu ${memberName} da equipe`,
      });

      return { taskId, memberId };
    },
    onSuccess: ({ taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-team-members', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-history', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      toast.success('Membro removido da equipe!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover membro: ' + error.message);
    },
  });
}

// Get tasks where user is a team member
export function useMyTeamTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-team-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get task IDs where user is a team member
      const { data: teamMemberships, error: teamError } = await supabase
        .from('task_team_members')
        .select('task_id')
        .eq('user_id', user.id);

      if (teamError) throw teamError;

      if (!teamMemberships || teamMemberships.length === 0) return [];

      const taskIds = teamMemberships.map(m => m.task_id);

      // Then get those tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', taskIds)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;

      return tasks || [];
    },
    enabled: !!user,
  });
}
