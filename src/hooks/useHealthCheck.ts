import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type HealthStatus = 'checking' | 'online' | 'offline' | 'timeout';

interface HealthCheckResult {
  status: HealthStatus;
  lastChecked: Date | null;
  retry: () => void;
  isOnline: boolean;
}

export function useHealthCheck(autoCheck = true): HealthCheckResult {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setStatus('checking');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      // Try a simple auth health check endpoint
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        setStatus('timeout');
      } else {
        // Network error (Failed to fetch)
        setStatus('offline');
      }
    }
    
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    if (autoCheck) {
      checkHealth();
    }
  }, [autoCheck, checkHealth]);

  return {
    status,
    lastChecked,
    retry: checkHealth,
    isOnline: status === 'online',
  };
}
