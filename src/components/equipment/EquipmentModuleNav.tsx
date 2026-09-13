import { ArrowLeftRight, Boxes } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const isLoansContext = (pathname: string) =>
  pathname.startsWith('/equipment/loans') ||
  pathname.startsWith('/equipment/loan/') ||
  pathname.startsWith('/equipment/reservations');

export function EquipmentModuleNav() {
  const { pathname } = useLocation();
  const loansActive = isLoansContext(pathname);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/55 px-4 py-4 shadow-[0_18px_55px_-42px_hsl(var(--primary))] sm:px-5">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/70">Módulo operacional</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Gestão de Equipamentos</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Inventário, empréstimos e disponibilidade em um só lugar.
          </p>
        </div>

        <nav
          aria-label="Navegação de Gestão de Equipamentos"
          className="grid w-full grid-cols-2 gap-1 rounded-xl border border-border/45 bg-background/30 p-1 xl:w-[420px]"
        >
          <Link
            to="/equipment"
            aria-current={!loansActive ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              !loansActive
                ? 'border border-primary/35 bg-primary/15 text-primary shadow-[0_0_24px_-14px_hsl(var(--primary))]'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
            )}
          >
            <Boxes className="h-4 w-4" />
            Patrimônios
          </Link>

          <Link
            to="/equipment/loans"
            aria-current={loansActive ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              loansActive
                ? 'border border-primary/35 bg-primary/15 text-primary shadow-[0_0_24px_-14px_hsl(var(--primary))]'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
            )}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Empréstimos
          </Link>
        </nav>
      </div>
    </section>
  );
}
