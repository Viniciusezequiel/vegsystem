import { useState } from 'react';
import { ArrowLeftRight, Boxes, KeyRound, Search, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LabLoansTabContent } from '@/components/equipment/LabLoansTabContent';

const isLoansContext = (pathname: string) =>
  pathname.startsWith('/equipment/loans') ||
  pathname.startsWith('/equipment/loan/') ||
  pathname.startsWith('/equipment/reservations');

export function EquipmentModuleNav() {
  const { pathname } = useLocation();
  const loansActive = isLoansContext(pathname);
  const [labOpen, setLabOpen] = useState(false);
  const [labSearch, setLabSearch] = useState('');

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-card/55 px-4 py-4 shadow-[0_18px_55px_-42px_hsl(var(--primary))] sm:px-5">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/70">Módulo operacional</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Gestão de Equipamentos</h1>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
              Inventário, empréstimos, chaves e utilização de laboratórios em um só lugar.
            </p>
          </div>

          <nav
            aria-label="Navegação de Gestão de Equipamentos"
            className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/45 bg-background/30 p-1 xl:w-[650px]"
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

            <button
              type="button"
              onClick={() => setLabOpen(true)}
              className="flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-card/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Chaves e Laboratórios</span>
              <span className="sm:hidden">Chaves/Lab</span>
            </button>
          </nav>
        </div>
      </section>

      <Dialog open={labOpen} onOpenChange={setLabOpen}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Chaves e Laboratórios
            </DialogTitle>
          </DialogHeader>

          <div className="relative mt-1 max-w-2xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              value={labSearch}
              onChange={(event) => setLabSearch(event.target.value)}
              placeholder="Buscar responsável, setor, chave, material ou funcionário..."
              className="h-10 pl-9 pr-10"
            />
            {labSearch && (
              <button
                type="button"
                onClick={() => setLabSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <LabLoansTabContent searchQuery={labSearch} />
        </DialogContent>
      </Dialog>
    </>
  );
}
