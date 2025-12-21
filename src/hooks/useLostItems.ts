import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { loadLostItemsFromCache, saveLostItemsToCache } from '@/lib/lostItemsCache';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';

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

// Track last expiration call to avoid calling it too often
let lastExpirationCall = 0;
const EXPIRATION_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Check if this is the default query (used for localStorage cache)
function isDefaultQuery(filters?: { 
  status?: string; 
  search?: string; 
  page?: number; 
  pageSize?: number;
  campus?: CampusEnum | 'all';
  dateFrom?: string;
  dateTo?: string;
  destination?: 'all' | 'donation' | 'disposal';
}): boolean {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 100;
  return (
    (filters?.status === 'available' || !filters?.status) &&
    !filters?.search &&
    page === 0 &&
    pageSize === 100 &&
    (!filters?.campus || filters.campus === 'all') &&
    !filters?.dateFrom &&
    !filters?.dateTo &&
    (!filters?.destination || filters.destination === 'all')
  );
}

export function useLostItems(filters?: { 
  status?: string; 
  search?: string; 
  page?: number; 
  pageSize?: number;
  campus?: CampusEnum | 'all';
  dateFrom?: string;
  dateTo?: string;
  destination?: 'all' | 'donation' | 'disposal';
}) {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 100;

  const initialData = isDefaultQuery(filters) ? loadLostItemsFromCache() : undefined;

  const offlineFilter = (allItems: LostItem[]) => {
    let list = allItems;

    if (filters?.status && filters.status !== 'all') {
      list = list.filter(i => i.status === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(i =>
        i.code?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.found_location?.toLowerCase().includes(q)
      );
    }

    if (filters?.campus && filters.campus !== 'all') {
      list = list.filter(i => i.campus === filters.campus);
    }

    if (filters?.dateFrom) {
      list = list.filter(i => (i.received_date || '') >= filters.dateFrom!);
    }
    if (filters?.dateTo) {
      list = list.filter(i => (i.received_date || '') <= filters.dateTo!);
    }

    if (filters?.destination && filters.destination !== 'all') {
      if (filters.destination === 'donation') {
        list = list.filter(i => i.owner_name === 'DOAÇÃO');
      } else if (filters.destination === 'disposal') {
        list = list.filter(i => i.owner_name === 'DESCARTE');
      }
    }

    const totalCount = list.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = list.slice(start, end);

    return {
      items,
      totalCount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
  };

  return useQuery({
    queryKey: ['lost-items', filters?.status, filters?.search, page, pageSize, filters?.campus, filters?.dateFrom, filters?.dateTo, filters?.destination],
    placeholderData: (previousData) => previousData ?? initialData,
    initialData: initialData ?? undefined,
    queryFn: async () => {
      // OFFLINE: serve from cache and do client-side filtering
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = loadLostItemsFromCache();
        return offlineFilter(cached?.items ?? []);
      }

      // Only call expiration function once every 5 minutes to improve performance
      const now = Date.now();
      if (now - lastExpirationCall > EXPIRATION_INTERVAL) {
        lastExpirationCall = now;
        (async () => {
          try {
            await supabase.rpc('expire_old_lost_items');
          } catch (e) {
            console.error('Error expiring items:', e);
          }
        })();
      }

      // Build the base query with pagination
      let query = supabase
        .from('lost_items')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.search) {
        query = query.or(`code.ilike.%${filters.search}%,description.ilike.%${filters.search}%,found_location.ilike.%${filters.search}%`);
      }

      if (filters?.campus && filters.campus !== 'all') {
        query = query.eq('campus', filters.campus);
      }

      if (filters?.dateFrom) {
        query = query.gte('received_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('received_date', filters.dateTo);
      }

      if (filters?.destination && filters.destination !== 'all') {
        if (filters.destination === 'donation') {
          query = query.eq('owner_name', 'DOAÇÃO');
        } else if (filters.destination === 'disposal') {
          query = query.eq('owner_name', 'DESCARTE');
        }
      }

      try {
        const { data, error, count } = await query;
        if (error) throw error;

        const result = {
          items: (data || []) as LostItem[],
          totalCount: count ?? 0,
          page,
          pageSize,
          totalPages: Math.ceil((count ?? 0) / pageSize),
        };

        if (isDefaultQuery(filters)) {
          saveLostItemsToCache(result);
        }

        return result;
      } catch (e) {
        // ONLINE error fallback: use local cache so the user can still search/view
        const cached = loadLostItemsFromCache();
        if (cached?.items?.length) {
          return offlineFilter(cached.items);
        }
        throw e;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Important: always refetch on mount (prevents poisoned cache from unauthenticated prefetch)
    refetchOnMount: true,
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const { data: item, error } = await supabase
        .from('lost_items')
        .insert({
          ...data,
          registered_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'lost-items',
        action: 'create',
        entity_id: item.id,
        entity_description: `Item ${data.code}`,
        details: `Cadastrou item "${data.description}" encontrado em ${data.found_location}`,
      });

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
      // Get current user info for activity log
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      // First fetch the existing item to compare changes
      const { data: existingItem } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id)
        .single();

      const { data: item, error } = await supabase
        .from('lost_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Build details of what changed
      const changedFields: string[] = [];
      if (existingItem) {
        if (data.description && data.description !== existingItem.description) changedFields.push('descrição');
        if (data.campus && data.campus !== existingItem.campus) changedFields.push('campus');
        if (data.found_location && data.found_location !== existingItem.found_location) changedFields.push('local encontrado');
        if (data.found_date && data.found_date !== existingItem.found_date) changedFields.push('data encontrado');
        if (data.received_date && data.received_date !== existingItem.received_date) changedFields.push('data recebido');
        if (data.shelf !== undefined && data.shelf !== existingItem.shelf) changedFields.push('prateleira');
        if (data.box !== undefined && data.box !== existingItem.box) changedFields.push('caixa');
        if (data.seal_number !== undefined && data.seal_number !== existingItem.seal_number) changedFields.push('lacre');
        if (data.delivered_by_name && data.delivered_by_name !== existingItem.delivered_by_name) changedFields.push('quem entregou');
        if (data.delivered_by_contact !== undefined && data.delivered_by_contact !== existingItem.delivered_by_contact) changedFields.push('contato entregou');
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'lost-items',
        action: 'update',
        entity_id: id,
        entity_description: `Item ${existingItem?.code || ''}`,
        details: changedFields.length > 0 
          ? `Campos alterados: ${changedFields.join(', ')}`
          : 'Item atualizado',
      });

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['lost-item'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      // Get existing item for logging
      const { data: existingItem } = await supabase
        .from('lost_items')
        .select('code, description')
        .eq('id', data.id)
        .single();

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

      // Log activity
      const actionDetails = data.destination === 'donation' 
        ? 'Encaminhou para doação'
        : data.destination === 'disposal'
        ? 'Encaminhou para descarte'
        : `Entregou ao proprietário: ${data.owner_name}`;

      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        user_name: profile?.full_name || user?.email || 'Sistema',
        module: 'lost-items',
        action: 'deliver',
        entity_id: data.id,
        entity_description: `Item ${existingItem?.code || ''}`,
        details: actionDetails,
      });

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      queryClient.invalidateQueries({ queryKey: ['lost-item'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
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
    mutationFn: async ({
      items,
      replaceExisting = false,
    }: {
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

      // Fix: "ON CONFLICT DO UPDATE ... cannot affect row a second time"
      // Happens when the *same file* contains repeated codes in the same batch.
      const dedupe = new Map<string, (typeof items)[number]>();
      for (const item of items) {
        const code = String(item.code ?? '').trim();
        if (!code) continue;
        dedupe.set(code, { ...item, code }); // keep last occurrence
      }
      const dedupedItems = Array.from(dedupe.values());
      const duplicateCount = items.length - dedupedItems.length;

      const itemsWithUser = dedupedItems.map(item => ({
        ...item,
        registered_by: user?.id,
        status: item.status || 'available',
      }));

      if (replaceExisting) {
        const { data, error } = await supabase
          .from('lost_items')
          .upsert(itemsWithUser, {
            onConflict: 'code',
            ignoreDuplicates: false,
          })
          .select();

        if (error) throw error;
        return { data: (data ?? []) as LostItem[], duplicateCount };
      }

      const { data, error } = await supabase
        .from('lost_items')
        .insert(itemsWithUser)
        .select();

      if (error) {
        // Friendly message for duplicate key in DB when user didn't choose replace
        if ((error as any)?.code === '23505') {
          throw new Error('Já existem itens com esse código no sistema. Marque “Substituir itens existentes com mesmo código” para atualizar os duplicados.');
        }
        throw error;
      }

      return { data: (data ?? []) as LostItem[], duplicateCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lost-items'] });
      const extra = result.duplicateCount > 0
        ? ` (${result.duplicateCount} duplicado(s) no arquivo foram mesclados pelo código)`
        : '';
      toast({
        title: 'Importação concluída',
        description: `${result.data.length} item(ns) importado(s) com sucesso.${extra}`,
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
