import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

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
  
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      items: MaterialRequestItem[];
      priority: 'low' | 'normal' | 'high' | 'urgent';
      assigned_to?: string;
      assigned_to_name?: string;
    }) => {
      if (!user?.id || !profile?.full_name) {
        throw new Error('Usuário não autenticado');
      }
      
      const { error } = await supabase
        .from('material_requests')
        .insert({
          requester_id: user.id,
          requester_name: profile.full_name,
          title: data.title,
          description: data.description,
          items: data.items as unknown as any,
          priority: data.priority,
          assigned_to: data.assigned_to,
          assigned_to_name: data.assigned_to_name,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
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
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      ...data 
    }: { 
      id: string; 
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
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
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_requests')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-material-requests'] });
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
