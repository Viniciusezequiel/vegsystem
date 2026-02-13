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
   GET ITEMS
============================ */

export function useLostItems() {
  return useQuery({
    queryKey: ['lost_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
  })
}

/* ============================
   CREATE ITEM
============================ */

export function useCreateLostItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newItem: Omit<LostItem, 'id'>) => {
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
   BULK CREATE
============================ */

export function useBulkCreateLostItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: Omit<LostItem, 'id'>[]) => {
      const { data, error } = await supabase
        .from('lost_items')
        .insert(items)
        .select()

      if (error) throw error
      return data
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
    mutationFn: async (ids: string[]) => {
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
