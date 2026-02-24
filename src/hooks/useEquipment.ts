import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Equipment = Database['public']['Tables']['equipment']['Row'];
export type EquipmentLoan = Database['public']['Tables']['equipment_loans']['Row'] & {
  equipment?: Equipment;
};

// Listar equipamentos (with optional search)
export const useEquipmentList = (search?: string) => {
  return useQuery({
    queryKey: ['equipmentList', search],
    queryFn: async () => {
      let query = supabase.from('equipment').select('*').order('created_at', { ascending: false });
      if (search) {
        query = query.or(`name.ilike.%${search}%,patrimony_code.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Equipment[];
    },
  });
};

// Listar empréstimos de equipamentos (with optional status filter)
export const useEquipmentLoans = (status?: string) => {
  return useQuery({
    queryKey: ['equipmentLoans', status],
    queryFn: async () => {
      let query = supabase
        .from('equipment_loans')
        .select('*, equipment:equipment_id(*)')
        .order('created_at', { ascending: false });
      if (status) {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as EquipmentLoan[];
    },
  });
};

// Overdue loans
export const useOverdueLoans = () => {
  return useQuery({
    queryKey: ['equipmentLoans', 'overdue'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('equipment_loans')
        .select('*, equipment:equipment_id(*)')
        .eq('status', 'active')
        .lt('expected_return_date', today)
        .order('expected_return_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EquipmentLoan[];
    },
  });
};

// Criar equipamento
export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (equipment: Database['public']['Tables']['equipment']['Insert']) => {
      const { data, error } = await supabase.from('equipment').insert(equipment).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipmentList'] }); },
  });
};

// Atualizar equipamento
export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Database['public']['Tables']['equipment']['Update'] & { id: string }) => {
      const { data, error } = await supabase.from('equipment').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipmentList'] }); },
  });
};

// Deletar equipamento
export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipmentList'] }); },
  });
};

// Criar empréstimo de equipamento
export const useCreateEquipmentLoan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (loan: any) => {
      const { data, error } = await supabase.from('equipment_loans').insert(loan).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['equipmentLoans'] }); },
  });
};

// Hook individual de equipamento (para edição)
export const useEquipment = (id: string) => {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipment').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Equipment;
    },
  });
};
