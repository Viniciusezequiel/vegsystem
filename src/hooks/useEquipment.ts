// src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Equipment {
  id: string;
  name: string;
  patrimony_code: string;
  patrimony_type: 'unique' | 'quantity';
  quantity: number;
  available_quantity: number;
  location: string;
  campus: string;
  category?: string;
  description?: string;
  status: string;
  image_url?: string | null;
  allow_external_loan: boolean;
}

// List all equipment
export function useEquipmentList() {
  return useQuery(['equipment-list'], async () => {
    const { data, error } = await supabase
      .from<Equipment>('equipment')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  });
}

// Get single equipment by ID
export function useEquipment(id: string) {
  return useQuery(['equipment', id], async () => {
    if (!id) return null;

    const { data, error } = await supabase
      .from<Equipment>('equipment')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }, { enabled: !!id });
}

// Create new equipment
export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation(async (payload: Partial<Equipment>) => {
    const { data, error } = await supabase.from('equipment').insert(payload).select();
    if (error) throw error;
    return data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-list']);
    }
  });
}

// Update existing equipment
export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation(async (payload: Partial<Equipment> & { id: string }) => {
    const { id, ...rest } = payload;
    const { data, error } = await supabase.from('equipment').update(rest).eq('id', id).select();
    if (error) throw error;
    return data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-list']);
    }
  });
}

// Delete equipment
export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation(async (id: string) => {
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) throw error;
    return id;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries(['equipment-list']);
    }
  });
}
