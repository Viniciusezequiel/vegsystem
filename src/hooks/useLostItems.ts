import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type LostItemRow = Database['public']['Tables']['lost_items']['Row'];

export type LostItem = LostItemRow;

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
export function useLostItem(id?: string) {
  return useQuery({
    queryKey: ['lost-item', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id!)
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
    mutationFn: async (item: Database['public']['Tables']['lost_items']['Insert']) => {
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
    mutationFn: async ({ id, ...updates }: Database['public']['Tables']['lost_items']['Update'] & { id: string }) => {
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
    mutationFn: async (id: string) => {
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
    mutationFn: async ({ id, ...delivery }: { id: string; owner_name?: string; owner_email?: string; owner_phone?: string; owner_signature?: string }) => {
      const { data, error } = await supabase
        .from('lost_items')
        .update({ status: 'delivered', delivered_at: new Date().toISOString(), ...delivery })
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
    mutationFn: async (items: Database['public']['Tables']['lost_items']['Insert'][]) => {
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
    mutationFn: async (ids: string[]) => {
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
