import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDeletableLostItemImagePath } from '@/lib/lostItemImageValue';
import { lostItemsQueryKeys } from '@/lib/lostItemsQueryKeys';
import { deleteStorageObjectSafely, loadReferencedLostItemImagePaths } from '@/lib/lostItemStorage';

export interface ArchivedLostItem {
  id: string;
  original_id: string;
  code: string;
  description: string;
  image_url: string | null;
  campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
  found_location: string;
  found_date: string;
  received_date: string;
  delivered_by_name: string;
  delivered_by_contact: string | null;
  delivered_by_team_member: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  owner_signature: string | null;
  status: string;
  delivered_at: string | null;
  registered_by: string | null;
  shelf: string | null;
  box: string | null;
  seal_number: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string;
  archived_by: string | null;
  archived_by_name: string | null;
}

const PAGE_SIZE = 50;
const ARCHIVED_ITEMS_LIST_SELECT = [
  'id',
  'original_id',
  'code',
  'description',
  'image_url',
  'campus',
  'found_location',
  'received_date',
  'status',
  'shelf',
  'box',
  'archived_at',
].join(',');

const ARCHIVED_ITEM_DETAIL_SELECT = [
  'id',
  'code',
  'description',
  'campus',
  'found_location',
  'received_date',
  'shelf',
  'box',
  'owner_name',
  'owner_phone',
  'owner_email',
  'delivered_at',
  'archived_at',
  'archived_by_name',
].join(',');

export function useArchivedLostItems(campus?: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm' | 'all') {
  return useInfiniteQuery({
    queryKey: lostItemsQueryKeys.archiveList(campus),
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('lost_items_archive')
        .select(ARCHIVED_ITEMS_LIST_SELECT)
        .order('archived_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (campus && campus !== 'all') {
        query = query.eq('campus', campus as 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm');
      }

      const { data, error } = await query;
      if (error) throw error;
      return {
        items: (data || []) as ArchivedLostItem[],
        pageParam,
        hasMore: data ? data.length === PAGE_SIZE : false,
      };
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.pageParam + 1 : undefined,
    initialPageParam: 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useArchivedLostItem(id?: string) {
  return useQuery({
    queryKey: lostItemsQueryKeys.archiveDetail(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('lost_items_archive')
        .select(ARCHIVED_ITEM_DETAIL_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Partial<ArchivedLostItem> | null;
    },
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useArchivedLostItemsCount() {
  return useQuery({
    queryKey: lostItemsQueryKeys.archiveCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('lost_items_archive')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
  });
}

export type ArchivedItemsDeleteSummary = {
  itemsDeleted: number;
  imagesRemoved: number;
  imagesPreserved: number;
};

export function useDeleteArchivedLostItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: ArchivedLostItem[]): Promise<ArchivedItemsDeleteSummary> => {
      const uniqueItems = [...new Map(items.map(item => [item.id, item])).values()];
      if (uniqueItems.length === 0) throw new Error('Selecione ao menos um item arquivado.');

      const ids = uniqueItems.map(item => item.id);
      const { data: deleted, error: deleteError } = await supabase
        .from('lost_items_archive')
        .delete()
        .in('id', ids)
        .select('id');
      if (deleteError) throw new Error('Não foi possível excluir os itens selecionados.');
      if ((deleted?.length ?? 0) !== ids.length) {
        throw new Error('A exclusão não foi concluída integralmente. Atualize a página antes de tentar novamente.');
      }

      const candidatePaths = new Set(
        uniqueItems
          .map(item => getDeletableLostItemImagePath(item.image_url))
          .filter((path): path is string => Boolean(path)),
      );
      let imagesRemoved = 0;
      let imagesPreserved = uniqueItems.filter(item => item.image_url && !getDeletableLostItemImagePath(item.image_url)).length;

      if (candidatePaths.size > 0) {
        let referencedPaths: Set<string>;
        try {
          referencedPaths = await loadReferencedLostItemImagePaths();
        } catch {
          return { itemsDeleted: ids.length, imagesRemoved: 0, imagesPreserved: imagesPreserved + candidatePaths.size };
        }

        for (const path of candidatePaths) {
          if (referencedPaths.has(path)) {
            imagesPreserved += 1;
            continue;
          }
          try {
            const result = await deleteStorageObjectSafely(path);
            if (result.removed) imagesRemoved += 1;
            else imagesPreserved += 1;
          } catch {
            imagesPreserved += 1;
          }
        }
      }

      return { itemsDeleted: ids.length, imagesRemoved, imagesPreserved };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lostItemsQueryKeys.archive });
      queryClient.invalidateQueries({ queryKey: lostItemsQueryKeys.archiveCount });
    },
  });
}
