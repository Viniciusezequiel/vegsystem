import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  category: string | null;
  due_date: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_by_name: string;
  assigned_to_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tags: string[] | null;
  attachments: any[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  content: string;
  created_at: string;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  due_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  estimated_hours?: number;
  tags?: string[];
  notes?: string;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  actual_hours?: number;
  started_at?: string;
  completed_at?: string;
}

export function useTasks(filters?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  category?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.priority && filters.priority !== 'all') {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useMyTasks() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Task;
    },
    enabled: !!id,
  });
}

export function useTaskComments(taskId: string) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as TaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TaskHistory[];
    },
    enabled: !!taskId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateTaskData) => {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          ...data,
          created_by: user?.id,
          created_by_name: profile?.full_name || user?.email || 'Sistema',
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'tasks',
        action: 'create',
        entity_id: task.id,
        entity_description: task.title,
        details: data.assigned_to_name ? `Designada para ${data.assigned_to_name}` : 'Sem designação',
      });

      // Log task history
      await supabase.from('task_history').insert({
        task_id: task.id,
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || 'Sistema',
        action: 'Criou a demanda',
      });

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('Demanda criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar demanda: ' + error.message);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data, oldTask }: { id: string; data: UpdateTaskData; oldTask?: Task }) => {
      // Handle status transitions
      const updateData: any = { ...data };
      
      if (data.status === 'in_progress' && oldTask?.status === 'pending') {
        updateData.started_at = new Date().toISOString();
      }
      
      if (data.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      const changes: string[] = [];
      if (data.status && data.status !== oldTask?.status) {
        changes.push(`Status: ${getStatusLabel(data.status)}`);
      }
      if (data.assigned_to_name && data.assigned_to !== oldTask?.assigned_to) {
        changes.push(`Designado para: ${data.assigned_to_name}`);
      }

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'tasks',
        action: 'update',
        entity_id: task.id,
        entity_description: task.title,
        details: changes.length > 0 ? changes.join(', ') : 'Dados atualizados',
      });

      // Log task history for status changes
      if (data.status && data.status !== oldTask?.status) {
        await supabase.from('task_history').insert({
          task_id: task.id,
          user_id: user?.id,
          user_name: profile?.full_name || user?.email || 'Sistema',
          action: 'Alterou status',
          field_changed: 'status',
          old_value: oldTask?.status,
          new_value: data.status,
        });
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['task-history'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('Demanda atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar demanda: ' + error.message);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'tasks',
        action: 'delete',
        entity_id: id,
        entity_description: title,
        details: 'Demanda excluída',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast.success('Demanda excluída!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir demanda: ' + error.message);
    },
  });
}

export function useAddTaskComment() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, content }: { taskId: string; content: string }) => {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user?.id,
          user_name: profile?.full_name || user?.email || 'Sistema',
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('task_history').insert({
        task_id: taskId,
        user_id: user?.id,
        user_name: profile?.full_name || user?.email || 'Sistema',
        action: 'Adicionou comentário',
      });

      return data;
    },
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-history', taskId] });
      toast.success('Comentário adicionado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar comentário: ' + error.message);
    },
  });
}

// Helper functions
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    cancelled: 'Cancelada',
    on_hold: 'Em Espera',
  };
  return labels[status] || status;
}

export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente',
  };
  return labels[priority] || priority;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
    in_progress: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30',
    cancelled: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30',
    on_hold: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  };
  return colors[status] || '';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30',
    normal: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30',
    high: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
    urgent: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  };
  return colors[priority] || '';
}
