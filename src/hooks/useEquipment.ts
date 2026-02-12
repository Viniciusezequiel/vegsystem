// src/hooks/useEquipment.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ------------------- LISTAGEM ------------------- //

// Lista de todos os equipamentos
export const useEquipmentList = () => {
  return useQuery(['equipmentList'], async () => {
    const { data, error } = await supabase.from('equipment').select('*');
    if (error) throw error;
    return data;
  });
};

// Buscar equipamento específico pelo id
export const useEquipment = (id: string) => {
  return useQuery(['equipment', id], async () => {
    const { data, error } = await supabase.from('equipment').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  });
};

// Lista de empréstimos de equipamentos
export const useEquipmentLoans = () => {
  return useQuery(['equipmentLoans'], async () => {
    const { data, error } = await supabase.from('equipment_loans').select('*');
    if (error) throw error;
    return data;
  });
};

// ------------------- MUTATIONS ------------------- //

// Criar equipamento
export const useCreateEquipment = () => {
  return {
    mutateAsync: async (newEquipment: any) => {
      const { data, error } = await supabase.from('equipment').insert([newEquipment]);
      if (error) throw error;
      return data;
    },
    isPending: false,
  };
};

// Atualizar equipamento
export const useUpdateEquipment = () => {
  return {
    mutateAsync: async (equipment: any) => {
      const { id, ...rest } = equipment;
      const { data, error } = await supabase.from('equipment').update(rest).eq('id', id);
      if (error) throw error;
      return data;
    },
    isPending: false,
  };
};

// Deletar equipamento
export const useDeleteEquipment = () => {
  return {
    mutateAsync: async (id: string) => {
      const { data, error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    isPending: false,
  };
};

// Criar empréstimo de equipamento
export const useCreateEquipmentLoan = () => {
  return {
    mutateAsync: async (loan: any) => {
      const { data, error } = await supabase.from('equipment_loans').insert([loan]);
      if (error) throw error;
      return data;
    },
    isPending: false,
  };
};
