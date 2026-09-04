import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  iconClassName?: string;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  className,
  iconClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card/65 p-4 shadow-sm transition-all duration-200 hover:border-primary/25 hover:bg-card/80',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>

          {trend && (
            <p
              className={cn(
                'mt-1 text-xs font-medium',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.isPositive ? '+' : ''}
              {trend.value}% este mês
            </p>
          )}
        </div>

        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            iconClassName || 'bg-primary/10 text-primary'
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
