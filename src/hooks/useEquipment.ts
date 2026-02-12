// src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Listar equipamentos
export const useEquipmentList = () => {
  return useQuery(['equipmentList'], async () => {
    const { data, error } = await supabase.from('equipment').select('*');
    if (error) throw error;
    return data;
  });
};

// Listar empréstimos de equipamentos
export const useEquipmentLoans = () => {
  return useQuery(['equipmentLoans'], async () => {
    const { data, error } = await supabase
      .from('equipment_loans')
      .select('*,equipment(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });
};

// Criar equipamento
export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation(
    async (equipment: any) => {
      const { data, error } = await supabase.from('equipment').insert(equipment).select();
      if (error) throw error;
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(['equipmentList']) }
  );
};

// Atualizar equipamento
export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation(
    async ({ id, ...updates }: any) => {
      const { data, error } = await supabase.from('equipment').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(['equipmentList']) }
  );
};

// Deletar equipamento
export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation(
    async (id: string) => {
      const { data, error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(['equipmentList']) }
  );
};

// Criar empréstimo de equipamento
export const useCreateEquipmentLoan = () => {
  const queryClient = useQueryClient();
  return useMutation(
    async (loan: any) => {
      const { data, error } = await supabase.from('equipment_loans').insert(loan).select();
      if (error) throw error;
      return data;
    },
    { onSuccess: () => queryClient.invalidateQueries(['equipmentLoans']) }
  );
};

// Hook individual de equipamento (para edição)
export const useEquipment = (id: string) => {
  return useQuery(['equipment', id], async () => {
    const { data, error } = await supabase.from('equipment').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  });
};
