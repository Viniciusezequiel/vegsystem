import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

export interface LostItem {
  id: string;
  code: string;
  description: string;
  image_url: string | null;
  campus: CampusEnum;
  found_location: string;
  found_date: string;
  received_date: string;
  shelf: string | null;
  box: string | null;
  seal_number: string | null;
  delivered_by_name: string;
  delivered_by_contact: string | null;
  registered_by: string | null;
  status: 'available' | 'pending' | 'delivered' | 'expired';
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_signature: string | null;
  delivered_at: string | null;
  delivered_by_team_member: string | null;
  created_at: string;
  updated_at: string;
}

export function useLostItems(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['lost-items', filters],
    queryFn: async () => {
      // First, call the function to update expired items
      await supabase.rpc('expire_old_lost_items');

      let query = supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,description.ilike.%${filters.search}%,found_location.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as LostItem[];
    },
  });
}

export function useLostItem(id: string | undefined) {
  return useQuery({
    queryKey: ['lost-item', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as LostItem | null;
    },
    enabled: !!id,
  });
}

export function useCreateLostItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      description: string;
      image_url?: string;
      campus: CampusEnum;
      found_location: string;
      found_date: string;
      received_date: string;
      shelf?: string;
      box?: string;
      seal_number?: string;
      delivered_by_name: string;
      delivered_by_contact?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: item, error } = await supabase
        .from('lost_items')
        .insert({
          ...data,
          registered_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      toast({
        title: 'Item cadastrado',
        description: 'O item foi cadastrado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateLostItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<LostItem> & { id: string }) => {
      const { data: item, error } = await supabase
        .from('lost_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['lost-item'] });
      toast({
        title: 'Item atualizado',
        description: 'O item foi atualizado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeliverLostItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      owner_name: string;
      owner_email: string;
      owner_phone: string;
      owner_signature?: string;
      destination?: 'owner' | 'donation' | 'disposal';
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const destinationText = data.destination === 'donation' ? 'Doação' : 
                              data.destination === 'disposal' ? 'Descarte' : '';

      const { data: item, error } = await supabase
        .from('lost_items')
        .update({
          status: 'delivered',
          owner_name: data.destination === 'donation' ? 'DOAÇÃO' : 
                      data.destination === 'disposal' ? 'DESCARTE' : data.owner_name,
          owner_email: data.owner_email || null,
          owner_phone: data.owner_phone || null,
          owner_signature: data.owner_signature,
          delivered_at: new Date().toISOString(),
          delivered_by_team_member: user?.id,
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['lost-item'] });
      toast({
        title: 'Item entregue',
        description: 'A entrega foi registrada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkDeliverLostItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      ids: string[];
      destination: 'donation' | 'disposal';
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const destinationName = data.destination === 'donation' ? 'DOAÇÃO' : 'DESCARTE';

      const { error } = await supabase
        .from('lost_items')
        .update({
          status: 'delivered',
          owner_name: destinationName,
          owner_email: null,
          owner_phone: null,
          delivered_at: new Date().toISOString(),
          delivered_by_team_member: user?.id,
        })
        .in('id', data.ids);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      const action = variables.destination === 'donation' ? 'doação' : 'descarte';
      toast({
        title: 'Itens atualizados',
        description: `${variables.ids.length} item(ns) designado(s) para ${action}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkCreateLostItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ items, replaceExisting = false }: {
      items: Array<{
        code: string;
        description: string;
        campus: CampusEnum;
        found_location: string;
        found_date: string;
        received_date: string;
        shelf?: string;
        box?: string;
        seal_number?: string;
        delivered_by_name: string;
        delivered_by_contact?: string;
        status?: string;
      }>;
      replaceExisting?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const itemsWithUser = items.map(item => ({
        ...item,
        registered_by: user?.id,
        status: item.status || 'available',
      }));

      if (replaceExisting) {
        // Use upsert to replace existing items
        const { data, error } = await supabase
          .from('lost_items')
          .upsert(itemsWithUser, { 
            onConflict: 'code',
            ignoreDuplicates: false 
          })
          .select();

        if (error) throw error;
        return data;
      } else {
        // Regular insert (will fail on duplicates)
        const { data, error } = await supabase
          .from('lost_items')
          .insert(itemsWithUser)
          .select();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      toast({
        title: 'Importação concluída',
        description: `${data.length} item(ns) importado(s) com sucesso.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteLostItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: 'Item excluído',
        description: 'O item foi excluído com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
