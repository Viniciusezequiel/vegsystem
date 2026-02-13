import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient' // caminho corrigido

export interface LostItem {
  id: number
  name?: string
  created_at?: string
}

export function useLostItems() {
  const [lostItems, setLostItems] = useState<LostItem[]>([])

  useEffect(() => {
    const fetchLostItems = async () => {
      const { data, error } = await supabase
        .from<LostItem>('lost_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar lost_items:', error)
        setLostItems([])
      } else {
        setLostItems(data ?? [])
      }
    }

    fetchLostItems()

    const subscription = supabase
      .from<LostItem>('lost_items')
      .on('*', payload => {
        console.log('Realtime lost_items:', payload)
        fetchLostItems()
      })
      .subscribe()

    return () => supabase.removeSubscription(subscription)
  }, [])

  return lostItems
}
