import { useEffect } from 'react';
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
  status: 'pending' | 'approved' | 'awaiting_pickup' | 'rejected' | 'loaned' | 'returned';
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
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('external-equipment-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'external_equipment_requests'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      
      // Get the current user session to ensure we're authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found for equipment requests');
        return [];
      }
      
      // Query using the authenticated user's email for RLS compatibility
      // RLS policy checks: lower(requester_email) = lower(auth.users.email)
      const { data, error } = await supabase
        .from('external_equipment_requests')
        .select('*, equipment:equipment_id(id, name, patrimony_code, campus)')
        .ilike('requester_email', user.email || email)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching equipment requests:', error);
        throw error;
      }
      
      console.log('Equipment requests fetched:', data?.length || 0, 'for email:', user.email);
      return data as ExternalEquipmentRequest[];
    },
    enabled: !!email,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
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
      // Call the edge function with rate limiting and validation
      const { data: result, error } = await supabase.functions.invoke('create-external-equipment-request', {
        body: {
          equipment_id: data.equipment_id,
          equipment_name: data.equipment_name,
          quantity_requested: data.quantity_requested,
          requester_name: data.requester_name,
          requester_email: data.requester_email,
          requester_phone: data.requester_phone,
          requester_organization: data.requester_organization,
          purpose: data.purpose,
          requested_date: data.requested_date,
          expected_return_date: data.expected_return_date,
        },
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to create request');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create request');
      }
      
      return result.request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests-by-email'] });
      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação foi enviada e será analisada pela equipe.',
      });
    },
    onError: (error: Error) => {
      let errorMessage = error.message;
      
      // Handle rate limiting error
      if (errorMessage.includes('Too many requests')) {
        errorMessage = 'Você fez muitas solicitações. Por favor, aguarde um minuto e tente novamente.';
      }
      
      toast({
        title: 'Erro',
        description: errorMessage,
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
      updateEquipmentQuantity,
      equipmentId,
      quantityChange,
      ...data 
    }: { 
      id: string; 
      status?: string;
      admin_notes?: string;
      processed_by?: string;
      processed_at?: string;
      updateEquipmentQuantity?: boolean;
      equipmentId?: string;
      quantityChange?: number;
    }) => {
      // Update the request
      const { error } = await supabase
        .from('external_equipment_requests')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;

      // If we need to update equipment quantity
      if (updateEquipmentQuantity && equipmentId && quantityChange !== undefined) {
        // Get current equipment
        const { data: equipment, error: eqError } = await supabase
          .from('equipment')
          .select('available_quantity')
          .eq('id', equipmentId)
          .single();
        
        if (eqError) throw eqError;
        
        const newQuantity = equipment.available_quantity + quantityChange;
        
        // Update equipment available quantity
        const { error: updateError } = await supabase
          .from('equipment')
          .update({ available_quantity: Math.max(0, newQuantity) })
          .eq('id', equipmentId);
        
        if (updateError) throw updateError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-equipment-requests'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
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
