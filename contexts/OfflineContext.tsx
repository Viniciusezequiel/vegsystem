import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  addToQueue,
  getQueue,
  getPendingCount,
  getFailedCount,
  type OfflineOperationModule,
  type OfflineOperationAction,
} from '@/lib/offlineQueue';
import { processQueue, startAutoSync, stopAutoSync, getIsSyncing } from '@/lib/syncManager';
import { toast } from 'sonner';

interface OfflineContextType {
  isOnline: boolean;
  isServerReachable: boolean;
  isOfflineMode: boolean; // true if offline OR server unreachable
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  queueOperation: (
    module: OfflineOperationModule,
    action: OfflineOperationAction,
    payload: Record<string, unknown>
  ) => string;
  syncNow: () => Promise<void>;
  refreshCounts: () => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// Health check timeout
const HEALTH_CHECK_TIMEOUT = 5000;
const HEALTH_CHECK_INTERVAL = 30000;

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [failedCount, setFailedCount] = useState(getFailedCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const isOfflineMode = !isOnline || !isServerReachable;

  const refreshCounts = useCallback(() => {
    setPendingCount(getPendingCount());
    setFailedCount(getFailedCount());
  }, []);

  // Check server reachability
  const checkServerHealth = useCallback(async () => {
    if (!navigator.onLine) {
      setIsServerReachable(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

      const { error } = await supabase.auth.getSession();
      clearTimeout(timeoutId);

      setIsServerReachable(!error);
    } catch {
      setIsServerReachable(false);
    }
  }, []);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkServerHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsServerReachable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkServerHealth();

    // Periodic health check
    const healthInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(healthInterval);
    };
  }, [checkServerHealth]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && isServerReachable) {
      const pending = getPendingCount();
      if (pending > 0) {
        syncNow();
      }
    }
  }, [isOnline, isServerReachable]);

  // Start auto-sync on mount
  useEffect(() => {
    startAutoSync(30000, (success, synced, failed) => {
      setIsSyncing(false);
      refreshCounts();
      
      if (synced > 0) {
        setLastSyncTime(new Date());
        toast.success(`${synced} operação(ões) sincronizada(s)`);
      }
      
      if (failed > 0) {
        toast.error(`${failed} operação(ões) falharam`);
      }
    });

    return () => stopAutoSync();
  }, [refreshCounts]);

  // Queue an operation for offline sync
  const queueOperation = useCallback((
    module: OfflineOperationModule,
    action: OfflineOperationAction,
    payload: Record<string, unknown>
  ): string => {
    const op = addToQueue(module, action, payload);
    refreshCounts();
    return op.id;
  }, [refreshCounts]);

  // Manual sync trigger
  const syncNow = useCallback(async () => {
    if (!isOnline || !isServerReachable) {
      toast.error('Sem conexão com o servidor');
      return;
    }

    setIsSyncing(true);
    
    try {
      const { synced, failed } = await processQueue();
      refreshCounts();
      
      if (synced > 0) {
        setLastSyncTime(new Date());
        toast.success(`${synced} operação(ões) sincronizada(s)`);
      }
      
      if (failed > 0) {
        toast.error(`${failed} operação(ões) falharam`);
      }
      
      if (synced === 0 && failed === 0) {
        toast.info('Nenhuma operação pendente');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isServerReachable, refreshCounts]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isServerReachable,
        isOfflineMode,
        pendingCount,
        failedCount,
        isSyncing,
        lastSyncTime,
        queueOperation,
        syncNow,
        refreshCounts,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
