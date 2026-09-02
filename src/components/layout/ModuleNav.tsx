import type { ElementType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface ModuleNavItem {
  label: string;
  href: string;
  icon?: ElementType;
  activeWhen?: (pathname: string) => boolean;
}

interface ModuleNavProps {
  title: string;
  description: string;
  items: ModuleNavItem[];
}

export function ModuleNav({ title, description, items }: ModuleNavProps) {
  const { pathname } = useLocation();

  return (
    <section className="border-b border-border/45 pb-3">
      <div className="mb-3">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <nav aria-label={`Navegação de ${title}`} className="flex w-full gap-1 overflow-x-auto rounded-lg bg-muted/35 p-1 sm:w-fit">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = item.activeWhen ? item.activeWhen(pathname) : pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex min-h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 text-sm font-medium transition-colors duration-200 sm:flex-none',
                isActive
                  ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:bg-background/55 hover:text-foreground'
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
