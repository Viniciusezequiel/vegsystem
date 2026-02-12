// src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase'; // ajuste o caminho se necessário

export interface Equipment {
  id: string;
  name: string;
  patrimony_code: string | null;
  patrimony_type: 'unique' | 'quantity';
  quantity: number;
  available_quantity: number;
  location: string;
  campus: string;
  category: string | null;
  description: string | null;
  status: 'available' | 'loaned';
  allow_external_loan: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// --------------------
// List all equipment
// --------------------
export function useEquipmentList() {
  return useQuery<Equipment[], Error>(['equipmentList'], async () => {
    const { data, error } = await supabase
      .from<Equipment>('equipment')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

// --------------------
// Get equipment by ID
// --------------------
export function useEquipmentById(id: string) {
  return useQuery<Equipment | null, Error>(
    ['equipment', id],
    async () => {
      const { data, error } = await supabase
        .from<Equipment>('equipment')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data || null;
    },
    { enabled: !!id }
  );
}

// --------------------
// Create equipment
// --------------------
export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation(
    async (newEquipment: Partial<Equipment>) => {
      const { data, error } = await supabase
        .from<Equipment>('equipment')
        .insert(newEquipment)
        .single();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['equipmentList']);
      },
    }
  );
}

// --------------------
// Update equipment
// --------------------
export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation(
    async (updatedEquipment: Partial<Equipment> & { id: string }) => {
      const { id, ...rest } = updatedEquipment;
      const { data, error } = await supabase
        .from<Equipment>('equipment')
        .update(rest)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['equipmentList']);
        queryClient.invalidateQueries(['equipment', variables.id]);
      },
    }
  );
}

// --------------------
// Delete equipment
// --------------------
export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation(
    async (id: string) => {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['equipmentList']);
      },
    }
  );
}
