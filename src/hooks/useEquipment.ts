// src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// =======================
// LISTA DE EQUIPAMENTOS
// =======================
export const useEquipmentList = () => {
  return useQuery(['equipmentList'], async () => {
    const { data, error } = await supabase.from('equipment').select('*');
    if (error) throw error;
    return data;
  });
};

// =======================
// LISTA DE EMPRÉSTIMOS DE EQUIPAMENTOS
// =======================
export const useEquipmentLoans = () => {
  return useQuery(['equipmentLoans'], async () => {
    const { data, error } = await supabase.from('equipment_loans').select('*');
    if (error) throw error;
    return data;
  });
};

// =======================
// CRIAR EQUIPAMENTO
// =======================
export const useCreateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async (newEquipment: any) => {
      const { data, error } = await supabase.from('equipment').insert(newEquipment);
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['equipmentList']);
      },
    }
  );
};

// =======================
// ATUALIZAR EQUIPAMENTO
// =======================
export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async (updatedEquipment: any) => {
      const { id, ...rest } = updatedEquipment;
      const { data, error } = await supabase
        .from('equipment')
        .update(rest)
        .eq('id', id);
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['equipmentList']);
      },
    }
  );
};

// =======================
// DELETAR EQUIPAMENTO
// =======================
export const useDeleteEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation(
    async (id: string) => {
      const { data, error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['equipmentList']);
      },
    }
  );
};
