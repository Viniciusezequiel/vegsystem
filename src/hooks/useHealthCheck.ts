import { useState, useEffect, useCallback } from 'react';

type HealthStatus = 'checking' | 'online' | 'offline' | 'timeout';

interface HealthCheckResult {
  status: HealthStatus;
  lastChecked: Date | null;
  retry: () => void;
  isOnline: boolean;
}

const HEALTH_TIMEOUT_MS = 8000;

export function useHealthCheck(autoCheck = true): HealthCheckResult {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setStatus('checking');

    const controller = new AbortController();

    // IMPORTANT: Some environments may not reliably reject fetch() on abort.
    // We enforce a hard timeout via Promise.race so status never gets stuck in "checking".
    const timeoutPromise = new Promise<Response>((_, reject) => {
      window.setTimeout(() => {
        try {
          controller.abort();
        } finally {
          reject(new Error('timeout'));
        }
      }, HEALTH_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
          method: 'GET',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);

      setStatus(response.ok ? 'online' : 'offline');
    } catch (error: any) {
      const name = error?.name;
      const message = String(error?.message ?? '');

      if (message === 'timeout' || name === 'AbortError') {
        setStatus('timeout');
      } else {
        // Network error (e.g., Failed to fetch)
        setStatus('offline');
      }
    } finally {
      setLastChecked(new Date());
    }
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
