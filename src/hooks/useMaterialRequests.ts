import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLogActivity } from '@/hooks/useActivityLogs';

export interface MaterialRequestItem {
  name: string;
  quantity: number;
  description?: string;
}

export interface MaterialRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  title: string;
  description?: string;
  items: MaterialRequestItem[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'delivered';
  admin_notes?: string;
  approved_by?: string;
  approved_at?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at: string;
}

export function useMaterialRequests(status?: string) {
  return useQuery({
    queryKey: ['material-requests', status],
    queryFn: async () => {
      let query = supabase
        .from('material_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map(item => ({
        ...item,
        items: (item.items as unknown as MaterialRequestItem[]) || []
      })) as MaterialRequest[];
    },
  });
}

export function useMyMaterialRequests() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-material-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('material_requests')
        .select('*')
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(item => ({
        ...item,
        items: (item.items as unknown as MaterialRequestItem[]) || []
      })) as MaterialRequest[];
    },
    enabled: !!user?.id,
  });
}

export function useCreateMaterialRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const logActivity = useLogActivity();
  
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      items: MaterialRequestItem[];
      priority: 'low' | 'normal' | 'high' | 'urgent';
      assigned_to?: string;
      assigned_to_name?: string;
    }) => {
      // SEMPRE buscar o usuário autenticado direto do servidor
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !currentUser?.id) {
        throw new Error('Não foi possível verificar sua identidade. Faça login novamente.');
      }
      
      const userId = currentUser.id;
      
      // Buscar nome fresco do banco
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', userId)
        .maybeSingle();
      
      const requesterName = freshProfile?.full_name || currentUser.email || 'Sistema';
      
      const { data: result, error } = await supabase
        .from('material_requests')
        .insert({
          requester_id: userId,
          requester_name: requesterName,
          title: data.title,
          description: data.description,
          items: data.items as unknown as any,
          priority: data.priority,
          assigned_to: data.assigned_to,
          assigned_to_name: data.assigned_to_name,
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...result, title: data.title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
      
      // Log activity
      logActivity.mutate({
        module: 'materials',
        action: 'create',
        entityId: data.id,
        entityDescription: data.title,
        details: `Solicitação de material criada: ${data.title}`,
      });
      
      toast({
        title: 'Solicitação criada',
        description: 'Sua solicitação foi enviada para análise.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMaterialRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const logActivity = useLogActivity();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      title,
      ...data 
    }: { 
      id: string; 
      title?: string;
      status?: string;
      admin_notes?: string;
      assigned_to?: string;
      assigned_to_name?: string;
    }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      if (data.status === 'approved' || data.status === 'rejected') {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('material_requests')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      return { id, status: data.status, title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
      
      // Log activity based on status change
      const actionMap: Record<string, 'approve' | 'reject' | 'deliver' | 'update'> = {
        approved: 'approve',
        rejected: 'reject',
        delivered: 'deliver',
      };
      const action = data.status ? actionMap[data.status] || 'update' : 'update';
      
      logActivity.mutate({
        module: 'materials',
        action,
        entityId: data.id,
        entityDescription: data.title || 'Solicitação de material',
        details: data.status 
          ? `Status alterado para: ${data.status === 'approved' ? 'Aprovado' : data.status === 'rejected' ? 'Rejeitado' : data.status === 'delivered' ? 'Entregue' : data.status}`
          : 'Solicitação atualizada',
      });
      
      toast({
        title: 'Solicitação atualizada',
        description: 'O status foi atualizado com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMaterialRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logActivity = useLogActivity();
  
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title?: string }) => {
      const { error } = await supabase
        .from('material_requests')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, title };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
      
      // Log activity
      logActivity.mutate({
        module: 'materials',
        action: 'delete',
        entityId: data.id,
        entityDescription: data.title || 'Solicitação de material',
        details: `Solicitação de material excluída`,
      });
      
      toast({
        title: 'Solicitação excluída',
        description: 'A solicitação foi removida do sistema.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
