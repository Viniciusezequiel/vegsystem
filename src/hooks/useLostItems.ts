import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LostItem {
  id: number;
  name?: string;
  description?: string;
  status?: string;
  campus?: string;
  created_at?: string;
  image_url?: string;
}

/* LISTAR TODOS */
export function useLostItems() {
  return useQuery({
    queryKey: ['lost-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    }
  });
}

/* BUSCAR POR ID */
export function useLostItem(id?: number) {
  return useQuery({
    queryKey: ['lost-item', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }
  });
}

/* CRIAR */
export function useCreateLostItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Partial<LostItem>) => {
      const { data, error } = await supabase
        .from('lost_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}

/* ATUALIZAR */
export function useUpdateLostItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LostItem> & { id: number }) => {
      const { data, error } = await supabase
        .from('lost_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}

/* DELETAR */
export function useDeleteLostItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('lost_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}

/* ENTREGAR */
export function useDeliverLostItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const { data, error } = await supabase
        .from('lost_items')
        .update({ status: 'delivered' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}

/* BULK CRIAR */
export function useBulkCreateLostItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Partial<LostItem>[]) => {
      const { data, error } = await supabase
        .from('lost_items')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}

/* BULK ENTREGAR */
export function useBulkDeliverLostItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase
        .from('lost_items')
        .update({ status: 'delivered' })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
    }
  });
}
