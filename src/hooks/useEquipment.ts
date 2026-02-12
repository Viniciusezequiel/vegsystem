import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

export function useEquipmentLoans() {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLoans() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('equipment_loans')   // nome exato da tabela
        .select('*')               // pega todas as colunas
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar equipment_loans:', error.message)
        setError(error.message)
        setLoans([])
      } else {
        setLoans(data || [])
      }

      setLoading(false)
    }

    fetchLoans()
  }, [])

  return { loans, loading, error }
}
