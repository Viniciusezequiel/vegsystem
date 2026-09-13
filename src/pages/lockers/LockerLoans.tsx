import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowLeftRight,
  Box,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Lightbulb,
  Mail,
  Phone,
  Plus,
  Search,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useLockerLoan, useLockerLoans, useReturnLocker, useExchangeLocker, useLockersList, useBulkReturnLockers, LockerLoan } from '@/hooks/useLockers';
import { LockerReturnDialog, LockerReturnData } from '@/components/lockers/LockerReturnDialog';
import { LockerExchangeDialog } from '@/components/lockers/LockerExchangeDialog';
import { LockerLoanDetailsDialog } from '@/components/lockers/LockerLoanDetailsDialog';
import { BulkReturnLockersDialog } from '@/components/lockers/BulkReturnLockersDialog';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { differenceInCalendarDays, format, parseISO, startOfMonth, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';
import { cn } from '@/lib/utils';

const isLockerLoansContext = (pathname: string) => pathname.startsWith('/lockers/loans') || pathname.startsWith('/lockers/loan/');

const lockerModuleItems: ModuleNavItem[] = [
  { label: 'Escaninhos', href: '/lockers', icon: Box, activeWhen: pathname => pathname.startsWith('/lockers') && !isLockerLoansContext(pathname) },
  { label: 'Alocações', href: '/lockers/loans', icon: ArrowLeftRight, activeWhen: isLockerLoansContext },
];

const PAGE_SIZE = 12;

function isOverdue(loan: LockerLoan) {
  if (loan.status !== 'active') return false;
  return differenceInCalendarDays(parseISO(loan.expected_return_date), new Date()) < 0;
}

function isDueSoon(loan: LockerLoan) {
  if (loan.status !== 'active') return false;
  const days = differenceInCalendarDays(parseISO(loan.expected_return_date), new Date());
  return days >= 0 && days <= 7;
}

function getVisualStatus(loan: LockerLoan) {
  if (loan.status === 'returned') {
    return { label: 'Devolvida', className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2 };
  }
  if (isOverdue(loan)) {
    const days = Math.abs(differenceInCalendarDays(parseISO(loan.expected_return_date), new Date()));
    return { label: `Atrasada${days ? ` · ${days}d` : ''}`, className: 'border-red-400/35 bg-red-500/10 text-red-300', icon: AlertTriangle };
  }
  if (isDueSoon(loan)) {
    const days = differenceInCalendarDays(parseISO(loan.expected_return_date), new Date());
    return { label: days === 0 ? 'Vence hoje' : `Vence em ${days}d`, className: 'border-amber-400/35 bg-amber-500/10 text-amber-300', icon: CalendarClock };
  }
  return { label: 'Ativa', className: 'border-sky-400/30 bg-sky-500/10 text-sky-300', icon: Clock3 };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

export default function LockerLoans() {
  const [searchParams] = useSearchParams();
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [bulkReturnOpen, setBulkReturnOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LockerLoan | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [page, setPage] = useState(1);

  const { data: activeLoans } = useLockerLoans('active');
  const { data: returnedLoans } = useLockerLoans('returned');
  const { data: selectedLoanDetails } = useLockerLoan(selectedLoan?.id, detailsDialogOpen);
  const { data: availableLockers } = useLockersList('available');
  const { data: allLockers } = useLockersList();
  const returnLocker = useReturnLocker();
  const exchangeLocker = useExchangeLocker();
  const bulkReturn = useBulkReturnLockers();

  const allLoans = useMemo(() => [...(activeLoans || []), ...(returnedLoans || [])], [activeLoans, returnedLoans]);

  const courses = useMemo(() => {
    return Array.from(new Set(allLoans.map(loan => loan.borrower_sector).filter((value): value is string => Boolean(value))))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allLoans]);

  const activeCount = activeLoans?.length || 0;
  const overdueCount = activeLoans?.filter(isOverdue).length || 0;
  const dueSoonCount = activeLoans?.filter(isDueSoon).length || 0;
  const returnedCount = returnedLoans?.length || 0;
  const totalLockers = allLockers?.length || 0;
  const occupiedLockers = allLockers?.filter(locker => locker.status === 'occupied').length || 0;
  const availableCount = allLockers?.filter(locker => locker.status === 'available').length || 0;
  const occupancyRate = totalLockers ? Math.round((occupiedLockers / totalLockers) * 100) : 0;

  const filteredLoans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const today = new Date();
    const monthStart = startOfMonth(today);
    const last30 = subDays(today, 30);

    return allLoans
      .filter(loan => {
        if (statusFilter === 'active' && loan.status !== 'active') return false;
        if (statusFilter === 'returned' && loan.status !== 'returned') return false;
        if (statusFilter === 'overdue' && !isOverdue(loan)) return false;
        if (statusFilter === 'due_soon' && !isDueSoon(loan)) return false;
        if (campusFilter !== 'all' && loan.locker?.campus !== campusFilter) return false;
        if (courseFilter !== 'all' && loan.borrower_sector !== courseFilter) return false;

        const createdAt = parseISO(loan.created_at);
        if (periodFilter === 'month' && createdAt < monthStart) return false;
        if (periodFilter === '30d' && createdAt < last30) return false;

        if (query) {
          const haystack = [
            loan.locker?.code,
            loan.borrower_name,
            loan.borrower_phone,
            loan.borrower_email,
            loan.borrower_sector,
            loan.locker?.campus,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const score = (loan: LockerLoan) => loan.status === 'returned' ? 3 : isOverdue(loan) ? 0 : isDueSoon(loan) ? 1 : 2;
        const difference = score(a) - score(b);
        if (difference !== 0) return difference;
        if (a.status === 'active' && b.status === 'active') {
          return parseISO(a.expected_return_date).getTime() - parseISO(b.expected_return_date).getTime();
        }
        return parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime();
      });
  }, [allLoans, searchQuery, statusFilter, campusFilter, courseFilter, periodFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
  const pagedLoans = filteredLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, campusFilter, courseFilter, periodFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handleOpenReturn = (loan: LockerLoan) => {
    setSelectedLoan(loan);
    setReturnDialogOpen(true);
  };

  const handleOpenDetails = (loan: LockerLoan) => {
    setSelectedLoan(loan);
    setDetailsDialogOpen(true);
  };

  const handleReturn = (data: LockerReturnData) => {
    if (!selectedLoan) return;
    returnLocker.mutate({
      loanId: selectedLoan.id,
      returnerName: data.returner_name,
      signature: data.signature,
      notes: data.notes,
    }, {
      onSuccess: () => {
        setReturnDialogOpen(false);
        setSelectedLoan(null);
      },
    });
  };

  const handleReturnFromDetails = () => {
    setDetailsDialogOpen(false);
    setReturnDialogOpen(true);
  };

  const handleExchangeFromDetails = () => {
    setDetailsDialogOpen(false);
    setExchangeDialogOpen(true);
  };

  const handleExchange = (newLockerId: string, reason: string) => {
    if (!selectedLoan) return;
    exchangeLocker.mutate({ loanId: selectedLoan.id, newLockerId, reason }, {
      onSuccess: () => {
        setExchangeDialogOpen(false);
        setSelectedLoan(null);
      },
    });
  };

  const formatDate = (date: string) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCampusFilter('all');
    setCourseFilter('all');
    setPeriodFilter('all');
  };

  const hasFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all' || campusFilter !== 'all' || courseFilter !== 'all' || periodFilter !== 'all';
  const statCardClass = 'group relative overflow-hidden rounded-2xl border border-border/45 bg-card/70 p-4 text-left shadow-[0_18px_45px_-30px_hsl(var(--primary)/0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <MainLayout>
      <div className="relative isolate -m-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-primary/[0.055] via-background/10 to-violet-500/[0.045] p-2 sm:-m-3 sm:p-3">
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-12 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative space-y-5">
          <ModuleNav title="Escaninhos" description="Gestão de escaninhos e alocações" items={lockerModuleItems} />

          <PageHeader
            title="Alocações"
            description="Gerencie ocupações, devoluções e prazos dos escaninhos em uma única visão."
            actions={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setBulkReturnOpen(true)} disabled={!activeLoans?.length}>
                  <Unlock className="mr-2 h-4 w-4" />
                  Liberar em lote
                </Button>

                <PdfExportButton
                  title="Relatório de Alocações de Escaninhos"
                  filename="alocacoes_escaninhos"
                  columns={[
                    { header: 'Escaninho', accessor: (row) => row.locker?.code || 'N/A' },
                    { header: 'Campus', accessor: (row) => row.locker?.campus || 'N/A' },
                    { header: 'Locatário', accessor: 'borrower_name' },
                    { header: 'Curso', accessor: (row) => row.borrower_sector || '-' },
                    { header: 'Telefone', accessor: 'borrower_phone' },
                    { header: 'Email', accessor: (row) => row.borrower_email || '-' },
                    { header: 'Data da Alocação', accessor: (row) => formatDate(row.created_at) },
                    { header: 'Previsão de Devolução', accessor: (row) => formatDate(row.expected_return_date) },
                    { header: 'Status', accessor: (row) => getVisualStatus(row).label },
                  ]}
                  data={allLoans}
                  filters={[
                    {
                      label: 'Status',
                      key: 'status',
                      options: [
                        { label: 'Ativo', value: 'active' },
                        { label: 'Devolvido', value: 'returned' },
                      ],
                    },
                  ]}
                />

                <Button asChild className="shadow-[0_12px_30px_-16px_hsl(var(--primary)/0.8)]">
                  <Link to="/lockers/loan/new"><Plus className="mr-2 h-4 w-4" />Nova Alocação</Link>
                </Button>
              </div>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" className={cn(statCardClass, statusFilter === 'active' && 'border-sky-400/35 bg-sky-500/[0.06]')} onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Alocações Ativas</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-sky-300">{activeCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Em uso atualmente</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300"><Users className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'overdue' && 'border-red-400/40 bg-red-500/[0.07]')} onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Atrasadas</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-red-300">{overdueCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Exigem atenção agora</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300"><AlertTriangle className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'due_soon' && 'border-amber-400/40 bg-amber-500/[0.07]')} onClick={() => setStatusFilter(statusFilter === 'due_soon' ? 'all' : 'due_soon')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Próximas do Vencimento</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-amber-300">{dueSoonCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Vencem em até 7 dias</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300"><CalendarClock className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'returned' && 'border-emerald-400/40 bg-emerald-500/[0.07]')} onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Devolvidas</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-300">{returnedCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Histórico registrado</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><CheckCircle2 className="h-5 w-5" /></div>
              </div>
            </button>
          </div>

          <div className="rounded-2xl border border-border/45 bg-card/60 p-3 shadow-[0_18px_50px_-36px_hsl(var(--primary)/0.65)] backdrop-blur-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={campusFilter} onValueChange={setCampusFilter}>
                <SelectTrigger><SelectValue placeholder="Campus" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Campus</SelectItem>
                  <SelectItem value="Campus I">Campus I</SelectItem>
                  <SelectItem value="Campus II">Campus II</SelectItem>
                  <SelectItem value="Campus IV">Campus IV</SelectItem>
                  <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="due_soon">Próximas do vencimento</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                  <SelectItem value="returned">Devolvidas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Cursos</SelectItem>
                  {courses.map(course => <SelectItem key={course} value={course}>{course}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Nome, telefone ou escaninho..." value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className="pl-9" />
              </div>
            </div>
            {hasFilters && (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground"><X className="mr-1 h-3.5 w-3.5" />Limpar filtros</Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <Card className="overflow-hidden border-border/45 bg-card/65 shadow-[0_22px_55px_-38px_hsl(var(--primary)/0.6)] backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between gap-3 border-b border-border/35 p-4">
                  <div>
                    <p className="font-semibold">Lista de Alocações</p>
                    <p className="text-xs text-muted-foreground">Prazos e ocupações organizados por prioridade</p>
                  </div>
                  <span className="rounded-lg border border-border/40 bg-background/25 px-2.5 py-1 text-xs text-muted-foreground">{filteredLoans.length} encontrada(s)</span>
                </div>

                {filteredLoans.length === 0 ? (
                  <ContentState title="Nenhuma alocação encontrada" description="Não há registros para os filtros selecionados." className="py-12" />
                ) : (
                  <div className="p-3">
                    <div className="hidden grid-cols-[80px_minmax(170px,1.3fr)_120px_minmax(150px,1fr)_115px_145px_135px_78px] gap-3 px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground xl:grid">
                      <span>Escaninho</span><span>Locatário</span><span>Curso</span><span>Contato</span><span>Alocação</span><span>Previsão</span><span>Status</span><span className="text-right">Ações</span>
                    </div>

                    <div className="space-y-2">
                      {pagedLoans.map(loan => {
                        const status = getVisualStatus(loan);
                        const StatusIcon = status.icon;
                        return (
                          <div key={loan.id} className={cn('grid gap-3 rounded-xl border border-border/40 bg-background/20 p-3 transition hover:border-primary/30 hover:bg-primary/[0.025] xl:grid-cols-[80px_minmax(170px,1.3fr)_120px_minmax(150px,1fr)_115px_145px_135px_78px] xl:items-center', isOverdue(loan) && 'border-red-400/25 bg-red-500/[0.035]')}>
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 min-w-14 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-2 font-semibold tabular-nums text-primary">{loan.locker?.code || 'N/A'}</div>
                            </div>

                            <div className="flex min-w-0 items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] font-semibold text-primary">{initials(loan.borrower_name)}</div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{loan.borrower_name}</p>
                                <p className="truncate text-xs text-muted-foreground">{loan.locker?.campus || 'Campus não informado'}</p>
                              </div>
                            </div>

                            <div className="min-w-0 text-xs text-muted-foreground"><span className="xl:hidden">Curso: </span><span className="text-foreground/90">{loan.borrower_sector || '-'}</span></div>

                            <div className="space-y-1 text-xs">
                              <span className="flex items-center gap-1.5 text-foreground/90"><Phone className="h-3.5 w-3.5 text-primary" />{loan.borrower_phone}</span>
                              {loan.borrower_email && <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{loan.borrower_email}</span></span>}
                            </div>

                            <div className="text-xs"><span className="text-muted-foreground xl:hidden">Alocação: </span>{formatDate(loan.created_at)}</div>

                            <div className={cn('text-xs', isOverdue(loan) && 'font-medium text-red-300')}>
                              <span className="text-muted-foreground xl:hidden">Previsão: </span>{formatDate(loan.expected_return_date)}
                            </div>

                            <Badge variant="outline" className={cn('w-fit whitespace-nowrap', status.className)}><StatusIcon className="mr-1 h-3.5 w-3.5" />{status.label}</Badge>

                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetails(loan)} aria-label="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                              {loan.status === 'active' && (
                                <Button variant="outline" size="sm" className="h-8 px-2 xl:w-8 xl:px-0" onClick={() => handleOpenReturn(loan)}>
                                  <CheckCircle2 className="h-4 w-4" /><span className="ml-1 xl:hidden">Devolver</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {pageCount > 1 && (
                      <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3">
                        <span className="text-xs text-muted-foreground">Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredLoans.length)} de {filteredLoans.length}</span>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="min-w-8 text-center text-xs font-medium">{page}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Card className="border-border/45 bg-card/75 shadow-[0_20px_55px_-38px_hsl(var(--primary)/0.7)] backdrop-blur-md">
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center gap-2"><Box className="h-4 w-4 text-primary" /><p className="font-semibold">Ocupação dos Escaninhos</p></div>
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-24 shrink-0 rounded-full p-[10px]" style={{ background: `conic-gradient(hsl(var(--primary)) ${occupancyRate * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
                      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card text-center shadow-inner">
                        <span className="text-xl font-semibold">{occupancyRate}%</span>
                        <span className="text-[10px] text-muted-foreground">ocupados</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2 text-xs">
                      <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Ocupados</span><strong>{occupiedLockers}</strong></div>
                      <div className="flex justify-between gap-2"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-400" />Disponíveis</span><strong>{availableCount}</strong></div>
                      <div className="flex justify-between gap-2 border-t border-border/30 pt-2"><span className="text-muted-foreground">Total</span><strong>{totalLockers}</strong></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/45 bg-card/75 backdrop-blur-md">
                <CardContent className="p-4">
                  <p className="mb-3 font-semibold">Ações rápidas</p>
                  <div className="space-y-2">
                    <Button asChild className="w-full justify-start"><Link to="/lockers/loan/new"><Plus className="mr-2 h-4 w-4" />Nova Alocação</Link></Button>
                    <Button variant="outline" className="w-full justify-start border-red-400/20 text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setStatusFilter('overdue')}><AlertTriangle className="mr-2 h-4 w-4" />Alocações Atrasadas</Button>
                    <Button asChild variant="outline" className="w-full justify-start"><Link to="/lockers?status=available"><Box className="mr-2 h-4 w-4" />Escaninhos Disponíveis</Link></Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setBulkReturnOpen(true)} disabled={!activeLoans?.length}><Unlock className="mr-2 h-4 w-4" />Liberar em lote</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/20 bg-primary/[0.045] backdrop-blur-md">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300"><Lightbulb className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold">Dica do VEG</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Use o filtro “Próximas do vencimento” para antecipar contatos e reduzir devoluções atrasadas.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <LockerLoanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loan={selectedLoanDetails ?? selectedLoan}
        onReturn={handleReturnFromDetails}
        onExchange={handleExchangeFromDetails}
        showReturnButton={selectedLoan?.status === 'active'}
      />

      {selectedLoan && (
        <LockerReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          lockerCode={selectedLoan.locker?.code || ''}
          borrowerName={selectedLoan.borrower_name}
          isPending={returnLocker.isPending}
        />
      )}

      {selectedLoan && (
        <LockerExchangeDialog
          open={exchangeDialogOpen}
          onOpenChange={setExchangeDialogOpen}
          onConfirm={handleExchange}
          currentLocker={selectedLoan.locker || null}
          availableLockers={availableLockers || []}
          isPending={exchangeLocker.isPending}
        />
      )}

      <BulkReturnLockersDialog
        open={bulkReturnOpen}
        onOpenChange={setBulkReturnOpen}
        loans={activeLoans || []}
        isPending={bulkReturn.isPending}
        onConfirm={(ids) => bulkReturn.mutate(ids, { onSuccess: () => setBulkReturnOpen(false) })}
      />
    </MainLayout>
  );
}
