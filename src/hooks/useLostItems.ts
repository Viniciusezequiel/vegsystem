import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface LostItem {
  id: string
  code: string
  description: string
  status: string
  campus: string
  found_location: string
  found_date: string
  box_number?: string | null
  created_at?: string
}

/* ============================
   GET ALL
============================ */

export function useLostItems() {
  return useQuery<LostItem[]>({
    queryKey: ['lost_items'],
    queryFn: async (): Promise<LostItem[]> => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return data ?? []
    },
    initialData: [],          // nunca undefined
    staleTime: 1000 * 60 * 2, // 2 minutos (melhora performance)
  })
}

/* ============================
   GET ONE
============================ */

export function useLostItem(id?: string) {
  return useQuery<LostItem | null>({
    queryKey: ['lost_item', id],
    enabled: !!id,
    queryFn: async (): Promise<LostItem | null> => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      return data
    },
  })
}

/* ============================
   CREATE
============================ */

export function useCreateLostItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newItem: Omit<LostItem, 'id'>): Promise<LostItem> => {
      const { data, error } = await supabase
        .from('lost_items')
        .insert(newItem)
        .select()
        .single()

      if (error) throw error

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
    },
  })
}

/* ============================
   UPDATE
============================ */

export function useUpdateLostItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      item: Partial<LostItem> & { id: string }
    ): Promise<LostItem> => {
      const { data, error } = await supabase
        .from('lost_items')
        .update(item)
        .eq('id', item.id)
        .select()
        .single()

      if (error) throw error

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
      queryClient.invalidateQueries({
        queryKey: ['lost_item', variables.id],
      })
    },
  })
}

/* ============================
   DELETE
============================ */

export function useDeleteLostItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('lost_items')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
    },
  })
}

/* ============================
   DELIVER (single)
============================ */

export function useDeliverLostItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('lost_items')
        .update({ status: 'delivered' })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
      queryClient.invalidateQueries({ queryKey: ['lost_item', id] })
    },
  })
}

/* ============================
   BULK CREATE
============================ */

export function useBulkCreateLostItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      items: Omit<LostItem, 'id'>[]
    ): Promise<LostItem[]> => {
      const { data, error } = await supabase
        .from('lost_items')
        .insert(items)
        .select()

      if (error) throw error

      return data ?? []
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
    },
  })
}

/* ============================
   BULK DELIVER
============================ */

export function useBulkDeliverLostItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string): Promise<void> => {
      const { error } = await supabase
        .from('lost_items')
        .update({ status: 'delivered' })
        .in('id', ids)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost_items'] })
    },
  })
}
