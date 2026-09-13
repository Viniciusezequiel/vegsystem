import { loanItemName } from '@/lib/equipmentLoanItems';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  useEquipmentLoan,
  useEquipmentLoans,
  useOverdueLoans,
  useReturnEquipment,
  useDeleteEquipmentLoan,
  type EquipmentLoan,
} from '@/hooks/useEquipment';
import { ReturnDialog, type ReturnData } from '@/components/equipment/ReturnDialog';
import { EquipmentLoanDetailsDialog } from '@/components/equipment/EquipmentLoanDetailsDialog';
import { EditReturnDateDialog } from '@/components/equipment/EditReturnDateDialog';
import { ReservationsTabContent } from '@/components/equipment/ReservationsTabContent';
import { ReservationFormDialog } from '@/components/equipment/ReservationFormDialog';
import { useEquipmentReservations } from '@/hooks/useEquipmentReservations';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EquipmentModuleNav } from '@/components/equipment/EquipmentModuleNav';
import { cn } from '@/lib/utils';

const borrowerTypeLabels: Record<string, string> = {
  aluno: 'Aluno',
  professor: 'Professor',
  funcionario: 'Funcionário',
};

export type GroupedLoan = {
  groupId: string;
  loans: EquipmentLoan[];
  borrower_name: string;
  borrower_phone: string;
  borrower_sector: string;
  borrower_type: string | null;
  purpose: string | null;
  expected_return_date: string;
  status: 'active' | 'returned' | 'overdue';
  collaborator_name: string | null;
  created_at: string;
};

function groupLoans(loans: EquipmentLoan[]): GroupedLoan[] {
  const groups = new Map<string, EquipmentLoan[]>();
  for (const loan of loans) {
    const key = loan.loan_group_id || loan.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(loan);
  }

  return Array.from(groups.entries()).map(([groupId, items]) => {
    const first = items[0];
    return {
      groupId,
      loans: items,
      borrower_name: first.borrower_name,
      borrower_phone: first.borrower_phone,
      borrower_sector: first.borrower_sector,
      borrower_type: first.borrower_type,
      purpose: first.purpose,
      expected_return_date: first.expected_return_date,
      status: first.status,
      collaborator_name: first.collaborator_name,
      created_at: first.created_at,
    };
  });
}

function LoanMetric({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'primary' | 'blue' | 'red' | 'green';
  icon: React.ReactNode;
}) {
  const map = {
    primary: {
      card: 'border-primary/35 bg-gradient-to-br from-primary/[0.14] via-card/75 to-card/55',
      icon: 'bg-primary/15 text-primary ring-primary/20',
      value: 'text-foreground',
    },
    blue: {
      card: 'border-sky-500/25 bg-gradient-to-br from-sky-500/[0.09] via-card/75 to-card/55',
      icon: 'bg-sky-500/12 text-sky-400 ring-sky-500/15',
      value: 'text-sky-300',
    },
    red: {
      card: 'border-red-500/25 bg-gradient-to-br from-red-500/[0.09] via-card/75 to-card/55',
      icon: 'bg-red-500/12 text-red-400 ring-red-500/15',
      value: 'text-red-300',
    },
    green: {
      card: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.09] via-card/75 to-card/55',
      icon: 'bg-emerald-500/12 text-emerald-400 ring-emerald-500/15',
      value: 'text-emerald-300',
    },
  }[tone];

  return (
    <div className={cn('rounded-2xl border p-4 transition hover:-translate-y-0.5', map.card)}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1', map.icon)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className={cn('mt-0.5 text-2xl font-bold tracking-tight tabular-nums', map.value)}>{value}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function EquipmentLoans() {
  const [activeTab, setActiveTab] = useState('reservations');
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedLoan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<EquipmentLoan | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<GroupedLoan | null>(null);
  const [editDateDialogOpen, setEditDateDialogOpen] = useState(false);
  const [groupToEditDate, setGroupToEditDate] = useState<GroupedLoan | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: activeLoans = [], isLoading: activeLoading } = useEquipmentLoans('active');
  const { data: awaitingReservations = [] } = useEquipmentReservations('awaiting_pickup');
  const { data: returnedLoans = [], isLoading: returnedLoading } = useEquipmentLoans('returned');
  const { data: overdueLoans = [], isLoading: overdueLoading } = useOverdueLoans();
  const { data: selectedLoanDetails } = useEquipmentLoan(selectedLoan?.id, detailsDialogOpen);
  const returnEquipment = useReturnEquipment();
  const deleteEquipmentLoan = useDeleteEquipmentLoan();

  const formatDate = (date: string) => format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });

  const isOverdue = (loan: EquipmentLoan) => {
    if (loan.status !== 'active') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const returnDate = parseISO(loan.expected_return_date);
    returnDate.setHours(0, 0, 0, 0);
    return returnDate < today;
  };

  const isGroupOverdue = (group: GroupedLoan) => group.loans.some(isOverdue);

  const filterLoans = (loans: EquipmentLoan[]) => {
    if (!searchQuery.trim()) return loans;
    const query = searchQuery.toLowerCase();
    return loans.filter((loan) =>
      loan.borrower_name.toLowerCase().includes(query) ||
      loan.borrower_phone.includes(query) ||
      loan.borrower_sector.toLowerCase().includes(query) ||
      loanItemName(loan).toLowerCase().includes(query) ||
      loan.equipment?.patrimony_code?.toLowerCase().includes(query) ||
      loan.equipment?.old_patrimony_code?.toLowerCase().includes(query) ||
      loan.collaborator_name?.toLowerCase().includes(query) ||
      loan.borrower_type?.toLowerCase().includes(query)
    );
  };

  const filteredActiveLoans = useMemo(() => filterLoans(activeLoans), [activeLoans, searchQuery]);
  const filteredReturnedLoans = useMemo(() => filterLoans(returnedLoans), [returnedLoans, searchQuery]);
  const filteredOverdueLoans = useMemo(() => filterLoans(overdueLoans), [overdueLoans, searchQuery]);

  const allActiveGroups = useMemo(() => groupLoans(activeLoans), [activeLoans]);
  const allOverdueGroups = useMemo(() => groupLoans(overdueLoans), [overdueLoans]);
  const allReturnedGroups = useMemo(() => groupLoans(returnedLoans), [returnedLoans]);
  const groupedActiveLoans = useMemo(
    () => groupLoans(filteredActiveLoans).filter((group) => !isGroupOverdue(group)),
    [filteredActiveLoans]
  );
  const groupedReturnedLoans = useMemo(() => groupLoans(filteredReturnedLoans), [filteredReturnedLoans]);
  const groupedOverdueLoans = useMemo(() => groupLoans(filteredOverdueLoans), [filteredOverdueLoans]);

  const nonOverdueActiveCount = allActiveGroups.filter((group) => !isGroupOverdue(group)).length;

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleOpenReturn = (group: GroupedLoan) => {
    setSelectedGroup(group);
    setSelectedLoan(group.loans[0]);
    setReturnDialogOpen(true);
  };

  const handleOpenDetails = (group: GroupedLoan) => {
    setSelectedGroup(group);
    setSelectedLoan(group.loans[0]);
    setDetailsDialogOpen(true);
  };

  const handleOpenEditDate = (group: GroupedLoan) => {
    setGroupToEditDate(group);
    setEditDateDialogOpen(true);
  };

  const handleReturn = (data: ReturnData) => {
    if (!selectedGroup) return;
    const loanIds = data.selectedLoanIds?.length ? data.selectedLoanIds : selectedGroup.loans.map((loan) => loan.id);
    returnEquipment.mutate({
      loanId: loanIds,
      returner_name: data.returner_name,
      returner_phone: data.returner_phone,
      returner_sector: data.returner_sector,
      item_condition: data.item_condition,
      notes: data.notes,
      return_signature: data.return_signature,
      return_collaborator_name: data.return_collaborator_name,
      all_items_returned: data.all_items_returned,
      pending_items_description: data.pending_items_description,
    }, {
      onSuccess: () => {
        setReturnDialogOpen(false);
        setSelectedGroup(null);
        setSelectedLoan(null);
      },
    });
  };

  const handleConfirmDelete = () => {
    if (!groupToDelete) return;
    deleteEquipmentLoan.mutate({ loanIds: groupToDelete.loans.map((loan) => loan.id) }, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setGroupToDelete(null);
      },
    });
  };

  const renderGroupedLoansCards = (groups: GroupedLoan[], showReturnButton = false) => {
    if (!groups.length) {
      return <ContentState title="Nenhum empréstimo encontrado" description="Não há registros para os filtros selecionados." className="py-10" />;
    }

    return (
      <div className="space-y-2">
        {groups.map((group) => {
          const overdue = isGroupOverdue(group);
          const expanded = expandedGroups.has(group.groupId);
          const equipmentLabel = group.loans.length === 1 ? loanItemName(group.loans[0]) : `${group.loans.length} equipamentos`;
          const firstPatrimony = group.loans[0]?.equipment?.patrimony_code || 'Item avulso';

          return (
            <article
              key={group.groupId}
              className={cn(
                'relative overflow-hidden rounded-2xl border bg-card/55 p-3 transition-all hover:-translate-y-0.5 hover:bg-card/70',
                overdue ? 'border-red-500/30 hover:border-red-500/45' : 'border-border/40 hover:border-primary/25'
              )}
            >
              <div className={cn('pointer-events-none absolute bottom-0 left-0 top-0 w-0.5', overdue ? 'bg-red-400' : group.status === 'returned' ? 'bg-emerald-400' : 'bg-sky-400')} />

              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(230px,1.3fr)_minmax(180px,.9fr)] xl:grid-cols-[minmax(260px,1.35fr)_minmax(190px,.85fr)_minmax(160px,.7fr)_minmax(190px,.85fr)_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', overdue ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-primary/15 bg-primary/[0.07] text-primary')}>
                    <ArrowLeftRight className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{equipmentLabel}</h3>
                      {group.loans.length > 1 && <span className="rounded-md border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[9px] font-medium text-primary">{group.loans.length} itens</span>}
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">{firstPatrimony}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                  <User className="h-4 w-4 shrink-0 text-primary/75" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{group.borrower_name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{borrowerTypeLabels[group.borrower_type || 'aluno'] || group.borrower_type || 'Solicitante'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                  <MapPin className="h-4 w-4 shrink-0 text-primary/75" />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] text-muted-foreground">Setor/curso</p>
                    <p className="truncate text-xs font-medium">{group.borrower_sector}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 xl:block">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">Prev. devolução</p>
                    <p className={cn('mt-0.5 text-xs font-semibold tabular-nums', overdue && 'text-red-300')}>{formatDate(group.expected_return_date)}</p>
                  </div>
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold xl:mt-1',
                    overdue
                      ? 'border-red-500/20 bg-red-500/10 text-red-300'
                      : group.status === 'returned'
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                  )}>
                    {overdue ? <AlertTriangle className="h-3.5 w-3.5" /> : group.status === 'returned' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {overdue ? 'Atrasado' : group.status === 'returned' ? 'Devolvido' : 'Ativo'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20" onClick={() => toggleExpanded(group.groupId)} title={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}>
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20" onClick={() => handleOpenDetails(group)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                  {showReturnButton && (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20" onClick={() => handleOpenEditDate(group)} title="Alterar devolução"><Edit3 className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" className="h-8 border-primary/20 bg-primary/[0.04] text-[10px] hover:bg-primary/10" onClick={() => handleOpenReturn(group)}>Devolver</Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20 text-destructive hover:text-destructive" onClick={() => { setGroupToDelete(group); setDeleteDialogOpen(true); }} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-3 grid gap-3 border-t border-border/30 pt-3 xl:grid-cols-[1.3fr_1fr]">
                  <div className="space-y-1.5">
                    {group.loans.map((loan) => (
                      <div key={loan.id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/20 px-3 py-2 text-xs">
                        <Package className="h-4 w-4 shrink-0 text-primary/70" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{loanItemName(loan)}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{loan.equipment_id ? `Patrimônio: ${loan.equipment?.patrimony_code || '—'}` : 'Item avulso'}{loan.equipment?.old_patrimony_code ? ` · antigo: ${loan.equipment.old_patrimony_code}` : ''}</p>
                        </div>
                        <span className="rounded-md bg-muted/30 px-2 py-1 text-[9px] text-muted-foreground">Qtd. {loan.quantity_borrowed}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/30 bg-background/20 p-3"><p className="flex items-center gap-1 text-[9px] text-muted-foreground"><Phone className="h-3 w-3" /> Telefone</p><a href={`https://wa.me/55${group.borrower_phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate font-medium text-primary hover:underline">{group.borrower_phone}</a></div>
                    <div className="rounded-xl border border-border/30 bg-background/20 p-3"><p className="flex items-center gap-1 text-[9px] text-muted-foreground"><FileText className="h-3 w-3" /> Finalidade</p><p className="mt-1 truncate font-medium">{group.purpose || '—'}</p></div>
                    <div className="rounded-xl border border-border/30 bg-background/20 p-3"><p className="flex items-center gap-1 text-[9px] text-muted-foreground"><User className="h-3 w-3" /> Colaborador</p><p className="mt-1 truncate font-medium">{group.collaborator_name || '—'}</p></div>
                    <div className="rounded-xl border border-border/30 bg-background/20 p-3"><p className="flex items-center gap-1 text-[9px] text-muted-foreground"><Calendar className="h-3 w-3" /> Registrado em</p><p className="mt-1 truncate font-medium">{formatDate(group.created_at)}</p></div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const loading = activeLoading || returnedLoading || overdueLoading;

  return (
    <MainLayout>
      <div className="space-y-4">
        <EquipmentModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <LoanMetric label="Pré-reservas" value={awaitingReservations.length} detail="aguardando retirada" tone="primary" icon={<CalendarClock className="h-5 w-5" />} />
          <LoanMetric label="Ativos" value={nonOverdueActiveCount} detail="empréstimos dentro do prazo" tone="blue" icon={<ArrowLeftRight className="h-5 w-5" />} />
          <LoanMetric label="Atrasados" value={allOverdueGroups.length} detail="pedem regularização" tone="red" icon={<AlertTriangle className="h-5 w-5" />} />
          <LoanMetric label="Devolvidos" value={allReturnedGroups.length} detail="registros recentes de devolução" tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>

        {allOverdueGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-left transition hover:border-red-500/45 hover:bg-red-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/12 text-red-300"><AlertTriangle className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-xs font-semibold text-red-300">{allOverdueGroups.length} empréstimo(s) com devolução atrasada</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">Abra a lista de atrasados para regularizar as pendências.</span></span>
            </span>
            <span className="hidden text-[10px] font-semibold text-red-300 sm:block">Ver atrasados →</span>
          </button>
        )}

        <div className="rounded-2xl border border-border/45 bg-card/55 p-3 shadow-[0_18px_55px_-46px_rgba(0,0,0,.8)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1 xl:max-w-[620px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
              <Input
                placeholder="Buscar equipamento, solicitante, patrimônio ou setor..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 border-border/45 bg-background/30 pl-9 pr-10"
              />
              {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca"><X className="h-4 w-4" /></button>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PdfExportButton
                title="Relatório de Empréstimos de Equipamentos"
                filename="emprestimos_equipamentos"
                columns={[
                  { header: 'Equipamento', accessor: (row) => loanItemName(row) },
                  { header: 'Patrimônio', accessor: (row) => row.equipment?.patrimony_code || 'Item avulso' },
                  { header: 'Qtd.', accessor: (row) => String(row.quantity_borrowed) },
                  { header: 'Tipo', accessor: (row) => borrowerTypeLabels[row.borrower_type || 'aluno'] || row.borrower_type || '' },
                  { header: 'Solicitante', accessor: 'borrower_name' },
                  { header: 'Setor', accessor: 'borrower_sector' },
                  { header: 'Telefone', accessor: 'borrower_phone' },
                  { header: 'Finalidade', accessor: (row) => row.purpose || '' },
                  { header: 'Prev. Devolução', accessor: (row) => formatDate(row.expected_return_date) },
                  { header: 'Colaborador', accessor: (row) => row.collaborator_name || '' },
                  { header: 'Status', accessor: 'status' },
                ]}
                data={[...activeLoans, ...returnedLoans]}
              />
              <Button onClick={() => setReservationDialogOpen(true)} variant="outline" className="h-9"><CalendarClock className="mr-2 h-4 w-4" /> Nova Pré-Reserva</Button>
              <Button asChild className="h-9 shadow-[0_0_28px_-14px_hsl(var(--primary))]"><Link to="/equipment/loan/new"><Plus className="mr-2 h-4 w-4" /> Novo Empréstimo</Link></Button>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl border border-border/45 bg-card/55 p-1 md:grid-cols-4">
            <TabsTrigger value="reservations" className="min-h-10 gap-2 rounded-lg text-xs"><CalendarClock className="h-4 w-4" /> Pré-reservas <span className="rounded-full bg-background/35 px-1.5 py-0.5 text-[9px]">{awaitingReservations.length}</span></TabsTrigger>
            <TabsTrigger value="active" className="min-h-10 gap-2 rounded-lg text-xs"><Clock3 className="h-4 w-4" /> Ativos <span className="rounded-full bg-background/35 px-1.5 py-0.5 text-[9px]">{groupedActiveLoans.length}</span></TabsTrigger>
            <TabsTrigger value="overdue" className="min-h-10 gap-2 rounded-lg text-xs"><AlertTriangle className="h-4 w-4" /> Atrasados <span className="rounded-full bg-background/35 px-1.5 py-0.5 text-[9px]">{groupedOverdueLoans.length}</span></TabsTrigger>
            <TabsTrigger value="returned" className="min-h-10 gap-2 rounded-lg text-xs"><CheckCircle2 className="h-4 w-4" /> Devolvidos <span className="rounded-full bg-background/35 px-1.5 py-0.5 text-[9px]">{groupedReturnedLoans.length}</span></TabsTrigger>
          </TabsList>

          <div className="min-h-[180px]">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/40 bg-card/45"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : (
              <>
                <TabsContent value="reservations" className="mt-0"><ReservationsTabContent searchQuery={searchQuery} /></TabsContent>
                <TabsContent value="active" className="mt-0">{renderGroupedLoansCards(groupedActiveLoans, true)}</TabsContent>
                <TabsContent value="overdue" className="mt-0">{renderGroupedLoansCards(groupedOverdueLoans, true)}</TabsContent>
                <TabsContent value="returned" className="mt-0">{renderGroupedLoansCards(groupedReturnedLoans)}</TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>

      <EquipmentLoanDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        loan={selectedLoanDetails ?? selectedLoan}
        loans={selectedGroup?.loans}
        onReturn={() => { setDetailsDialogOpen(false); setReturnDialogOpen(true); }}
        showReturnButton={selectedGroup?.status === 'active'}
      />

      {selectedGroup && (
        <ReturnDialog
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onConfirm={handleReturn}
          itemName={selectedGroup.loans.length > 1 ? `${selectedGroup.loans.length} equipamentos` : loanItemName(selectedGroup.loans[0])}
          itemNames={selectedGroup.loans.map((loan) => ({ name: loanItemName(loan), patrimony: loan.equipment?.patrimony_code || 'Item avulso', quantity: loan.quantity_borrowed, loanId: loan.id }))}
          borrowerName={selectedGroup.borrower_name}
          isPending={returnEquipment.isPending}
        />
      )}

      <ReservationFormDialog open={reservationDialogOpen} onOpenChange={setReservationDialogOpen} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {groupToDelete?.loans.length === 1 ? 'este empréstimo' : `estes ${groupToDelete?.loans.length} empréstimos`}?
              {groupToDelete?.status === 'active' && ' O estoque dos equipamentos será restaurado.'} Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteEquipmentLoan.isPending}>
              {deleteEquipmentLoan.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditReturnDateDialog open={editDateDialogOpen} onOpenChange={setEditDateDialogOpen} group={groupToEditDate} />
    </MainLayout>
  );
}
