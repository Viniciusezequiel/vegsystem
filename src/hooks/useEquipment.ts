import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'

// Lista equipamentos (não empréstimos)
export function useEquipmentList() {
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEquipment() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('equipment') // sua tabela de equipamentos
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
        setEquipment([])
      } else {
        setEquipment(data || [])
      }

      setLoading(false)
    }

    fetchEquipment()
  }, [])

  return { equipment, loading, error }
}

// Lista empréstimos
export function useEquipmentLoans() {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLoans() {
      setLoading(true)
      setError(null)
