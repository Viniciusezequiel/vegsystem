import { useOffline } from '@/contexts/OfflineContext';
import { WifiOff, Cloud, CloudOff, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const {
    isOnline,
    isServerReachable,
    isOfflineMode,
    pendingCount,
    failedCount,
    isSyncing,
    syncNow,
  } = useOffline();

  // Don't show if everything is online and no pending ops
  if (!isOfflineMode && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        message: 'Sem conexão com a internet',
        variant: 'destructive' as const,
        bgClass: 'bg-destructive/10 border-destructive/30',
        textClass: 'text-destructive',
      };
    }
    
    if (!isServerReachable) {
      return {
        icon: CloudOff,
        message: 'Servidor indisponível',
        variant: 'warning' as const,
        bgClass: 'bg-amber-500/10 border-amber-500/30',
        textClass: 'text-amber-600 dark:text-amber-400',
      };
    }

    if (isSyncing) {
      return {
        icon: Loader2,
        message: 'Sincronizando...',
        variant: 'syncing' as const,
        bgClass: 'bg-blue-500/10 border-blue-500/30',
        textClass: 'text-blue-600 dark:text-blue-400',
      };
    }

    if (failedCount > 0) {
      return {
        icon: AlertTriangle,
        message: `${failedCount} operação(ões) falharam`,
        variant: 'error' as const,
        bgClass: 'bg-destructive/10 border-destructive/30',
        textClass: 'text-destructive',
      };
    }

    if (pendingCount > 0) {
      return {
        icon: Cloud,
        message: `${pendingCount} operação(ões) pendente(s)`,
        variant: 'pending' as const,
        bgClass: 'bg-amber-500/10 border-amber-500/30',
        textClass: 'text-amber-600 dark:text-amber-400',
      };
    }

    return null;
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 px-4 py-2 border-b flex items-center justify-center gap-3 text-sm backdrop-blur-sm',
        config.bgClass
      )}
    >
      <Icon className={cn('h-4 w-4', config.textClass, isSyncing && 'animate-spin')} />
      
      <span className={cn('font-medium', config.textClass)}>
        {config.message}
      </span>

      {pendingCount > 0 && !isSyncing && (
        <span className="text-muted-foreground text-xs">
          • {pendingCount} aguardando sync
        </span>
      )}

      {isOnline && isServerReachable && pendingCount > 0 && !isSyncing && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={syncNow}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Sincronizar agora
        </Button>
      )}
    </div>
  );
}
