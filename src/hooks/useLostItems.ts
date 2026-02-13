import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface LostItem {
  id: number
  name?: string
  status?: string
  created_at?: string
}

/* ================================
   LISTAR ITENS
================================ */

export function useLostItems() {
  const [lostItems, setLostItems] = useState<LostItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLostItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('lost_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar lost_items:', error)
      setLostItems([])
    } else {
      setLostItems(data ?? [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLostItems()

    const channel = supabase
      .channel('lost_items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lost_items' },
        () => {
          fetchLostItems()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLostItems])

  return { lostItems, loading }
}

/* ================================
   CRIAR ITEM INDIVIDUAL
================================ */

export function useCreateLostItem() {
  const [loading, setLoading] = useState(false)

  const createLostItem = async (
    item: Omit<LostItem, 'id' | 'created_at'>
  ) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('lost_items')
      .insert([item])
      .select()
      .single()

    setLoading(false)

    if (error) {
      console.error('Erro ao criar lost_item:', error)
      throw error
    }

    return data
  }

  return { createLostItem, loading }
}

/* ================================
   CRIAÇÃO EM LOTE
================================ */

export function useBulkCreateLostItems() {
  const [loading, setLoading] = useState(false)

  const bulkCreate = async (
    items: Omit<LostItem, 'id' | 'created_at'>[]
  ) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('lost_items')
      .insert(items)
      .select()

    setLoading(false)

    if (error) {
      console.error('Erro ao criar itens em lote:', error)
      throw error
    }

    return data
  }

  return { bulkCreate, loading }
}

/* ================================
   ENTREGAR EM LOTE (mudar status)
================================ */

export function useBulkDeliverLostItems() {
  const [loading, setLoading] = useState(false)

  const bulkDeliver = async (ids: number[]) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('lost_items')
      .update({ status: 'delivered' })
      .in('id', ids)
      .select()

    setLoading(false)

    if (error) {
      console.error('Erro ao entregar itens em lote:', error)
      throw error
    }

    return data
  }

  return { bulkDeliver, loading }
}
