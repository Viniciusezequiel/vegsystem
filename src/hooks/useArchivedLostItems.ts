import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export function useArchivedLostItems(campus?: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm' | 'all') {
  return useInfiniteQuery({
    queryKey: ['lost-items-archive', campus],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('lost_items_archive')
        .select('*')
        .order('archived_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (campus && campus !== 'all') {
        query = query.eq('campus', campus as 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm');
      }

      const { data, error } = await query;
      if (error) throw error;
      return {
        items: (data || []) as ArchivedLostItem[],
        nextPage: data && data.length === PAGE_SIZE ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });
}

export function useArchivedLostItemsCount() {
  return useQuery({
    queryKey: ['lost-items-archive-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('lost_items_archive')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
  });
}
