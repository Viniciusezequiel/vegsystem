import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface LostItem {
  id: number
  name?: string
  status?: string
  created_at?: string
}

/* =====================================================
   LISTAR TODOS
===================================================== */

export function useLostItems() {
  const [lostItems, setLostItems] = useState<LostItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLostItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('lost_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
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
        fetchLostItems
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLostItems])

  return { lostItems, loading }
}

/* =====================================================
   BUSCAR UM ITEM POR ID
===================================================== */

export function useLostItem(id?: number) {
  const [lostItem, setLostItem] = useState<LostItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const fetchItem = async () => {
      const { data, error } = await supabase
        .from('lost_items')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error(error)
        setLostItem(null)
      } else {
        setLostItem(data)
      }

      setLoading(false)
    }

    fetchItem()
  }, [id])

  return { lostItem, loading }
}

/* =====================================================
   CRIAR
===================================================== */

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

    if (error) throw error

    return data
  }

  return { createLostItem, loading }
}

/* =====================================================
   ATUALIZAR
===================================================== */

export function useUpdateLostItem() {
  const [loading, setLoading] = useState(false)

  const updateLostItem = async (
    id: number,
    updates: Partial<LostItem>
  ) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('lost_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    setLoading(false)

    if (error) throw error

    return data
  }

  return { updateLostItem, loading }
}

/* =====================================================
   ENTREGAR ITEM
===================================================== */

export function useDeliverLostItem() {
  const { updateLostItem } = useUpdateLostItem()

  const deliverLostItem = async (id: number) => {
    return updateLostItem(id, { status: 'delivered' })
  }

  return { deliverLostItem }
}

/* =====================================================
   DELETAR
===================================================== */

export function useDeleteLostItem() {
  const [loading, setLoading] = useState(false)

  const deleteLostItem = async (id: number) => {
    setLoading(true)

    const { error } = await supabase
      .from('lost_items')
      .delete()
      .eq('id', id)

    setLoading(false)

    if (error) throw error
  }

  return { deleteLostItem, loading }
}

/* =====================================================
   BULK CREATE
===================================================== */

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

    if (error) throw error

    return data
  }

  return { bulkCreate, loading }
}

/* =====================================================
   BULK DELIVER
===================================================== */

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

    if (error) throw error

    return data
  }

  return { bulkDeliver, loading }
}
