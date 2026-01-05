import { useImagePrefetchProgress } from '@/hooks/useImagePrefetchProgress';
import { Progress } from '@/components/ui/progress';
import { ImageIcon, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function ImagePrefetchIndicator() {
  const { total, loaded, isComplete, percentage } = useImagePrefetchProgress();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show indicator when prefetching starts
  useEffect(() => {
    if (total > 0 && !dismissed) {
      setVisible(true);
    }
  }, [total, dismissed]);

  // Auto-hide after completion
  useEffect(() => {
    if (isComplete && visible) {
      const timer = setTimeout(() => {
        setVisible(false);
        setDismissed(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, visible]);

  // Don't render if nothing to show
  if (!visible || total === 0) {
    return null;
  }

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[240px] transition-all duration-300",
        isComplete ? "opacity-80" : "opacity-100"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground animate-pulse" />
        )}
        <span className="text-sm font-medium text-foreground">
          {isComplete ? 'Imagens carregadas!' : 'Carregando imagens...'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={percentage} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {loaded}/{total}
        </span>
      </div>
    </div>
  );
}
