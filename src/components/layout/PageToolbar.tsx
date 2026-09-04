import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageToolbarProps {
  children: ReactNode;
  className?: string;
}

export function PageToolbar({
  children,
  className,
}: PageToolbarProps) {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-border/60 bg-card/65 p-3 shadow-sm',
        className
      )}
    >
      {children}
    </div>
  );
}
