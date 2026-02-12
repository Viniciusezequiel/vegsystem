import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

type HealthStatus = 'checking' | 'online' | 'offline'

interface HealthCheckResult {
  status: HealthStatus
  lastChecked: Date | null
  retry: () => void
  isOnline: boolean
}

export function useHealthCheck(autoCheck = true): HealthCheckResult {
  const [status, setStatus] = useState<HealthStatus>('checking')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const checkHealth = useCallback(async () => {
    setStatus('checking')

    try {
      // Operação leve e segura
      const { error } = await supabase.auth.getSession()

      if (error) {
        setStatus('offline')
      } else {
        setStatus('online')
      }
    } catch {
      setStatus('offline')
    } finally {
      setLastChecked(new Date())
    }
  }, [])

  useEffect(() => {
    if (autoCheck) {
      checkHealth()
    }
  }, [autoCheck, checkHealth])

  return {
    status,
    lastChecked,
    retry: checkHealth,
    isOnline: status === 'online',
  }
}
