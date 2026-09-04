import type { ElementType, ReactNode } from 'react';
import { Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentStateProps {
  title: string;
  description?: string;
  icon?: ElementType;
  loading?: boolean;
  action?: ReactNode;
  className?: string;
}

export function ContentState({
  title,
  description,
  icon: Icon = Inbox,
  loading = false,
  action,
  className,
}: ContentStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-10 text-center',
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Icon className="h-5 w-5" />
        )}
      </div>

      <p className="text-sm font-medium text-foreground">{title}</p>

      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
