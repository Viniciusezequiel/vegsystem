import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExternalEquipmentRequest {
  id: string;
  equipment_id: string | null;
  equipment_name: string;
  quantity_requested: number;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  requester_organization: string | null;
  purpose: string;
  requested_date: string;
  expected_return_date: string;
  status: 'pending' | 'approved' | 'rejected' | 'loaned' | 'returned';
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  equipment?: {
    id: string;
    name: string;
    patrimony_code: string;
    available_quantity: number;
    campus: string;
  };
}

export function useExternalEquipmentRequests(status?: string) {
  return useQuery({
    queryKey: ['external-equipment-requests', status],
    queryFn: async () => {
      let query = supabase
        .from('external_equipment_requests')
        .select('*, equipment:equipment_id(id, name, patrimony_code, available_quantity, campus)')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data as ExternalEquipmentRequest[];
    },
  });
}

export function useExternalEquipmentRequestsByEmail(email: string) {
  return useQuery({
    queryKey: ['external-equipment-requests-by-email', email],
    queryFn: async () => {
      if (!email) return [];
      
      const { data, error } = await supabase
        .from('external_equipment_requests')
        .select('*, equipment:equipment_id(id, name, patrimony_code, campus)')
        .eq('requester_email', email.toLowerCase())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as ExternalEquipmentRequest[];
    },
    enabled: !!email,
  });
}

export function useCreateExternalEquipmentRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: {
      equipment_id?: string;
      equipment_name: string;
      quantity_requested: number;
      requester_name: string;
      requester_email: string;
      requester_phone: string;
      requester_organization?: string;
      purpose: string;
      requested_date: string;
      expected_return_date: string;
    }) => {
      const { error } = await supabase
        .from('external_equipment_requests')
        .insert({
          ...data,
          requester_email: data.requester_email.toLowerCase(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação foi enviada e será analisada pela equipe.',
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

export function useUpdateExternalEquipmentRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      ...data 
    }: { 
      id: string; 
      status?: string;
      admin_notes?: string;
      processed_by?: string;
      processed_at?: string;
    }) => {
      const { error } = await supabase
        .from('external_equipment_requests')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
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

export function useDeleteExternalEquipmentRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('external_equipment_requests')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      toast({
        title: 'Solicitação excluída',
        description: 'A solicitação foi removida.',
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
