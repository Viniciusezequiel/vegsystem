// src/hooks/useHealthCheck.ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase/client' // caminho relativo correto

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
      // Pega a sessão atual do usuário
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Erro ao verificar sessão:', error.message)
        setStatus('offline')
      } else if (data.session) {
        setStatus('online')
      } else {
        setStatus('offline')
      }
    } catch (err) {
      console.error('Erro inesperado no health check:', err)
      setStatus('offline')
    } finally {
      setLastChecked(new Date())
    }
  }, [])

  useEffect(() => {
    if (autoCheck) {
      checkHealth()
      // Opcional: você pode fazer checagens periódicas
      const interval = setInterval(checkHealth, 60000) // checa a cada 60s
      return () => clearInterval(interval)
    }
  }, [autoCheck, checkHealth])

  return {
    status,
    lastChecked,
    retry: checkHealth,
    isOnline: status === 'online',
  }
}
