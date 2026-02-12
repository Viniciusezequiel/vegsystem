// src/hooks/useEquipment.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Lista de equipamentos
export const useEquipmentList = () => {
  return useQuery(['equipmentList'], async () => {
    const { data, error } = await supabase.from('equipment').select('*');
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

// Criação de equipamento
export const useCreateEquipment = () => {
  // Aqui você coloca a lógica de create, por exemplo com mutateAsync do react-query
  return {
    mutateAsync: async (newEquipment: any) => {
      const { data, error } = await supabase.from('equipment').insert([newEquipment]);
      if (error) throw error;
      return data;
    },
    isPending: false, // ajuste se usar useMutation
  };
};

// Atualização de equipamento
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

// ✅ Buscar equipamento específico (para edição)
export const useEquipment = (id: string) => {
  return useQuery(['equipment', id], async () => {
    const { data, error } = await supabase.from('equipment').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  });
};
