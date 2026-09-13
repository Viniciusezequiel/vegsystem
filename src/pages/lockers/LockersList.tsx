import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  ArrowLeftRight,
  Box,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Gauge,
  LayoutGrid,
  Layers3,
  List,
  Lock,
  LockOpen,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useLockersList, useCreateLocker, useUpdateLocker, useDeleteLocker, Locker } from '@/hooks/useLockers';
import { useAuth } from '@/contexts/AuthContext';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ModuleNav, type ModuleNavItem } from '@/components/layout/ModuleNav';

const isLockerLoansContext = (pathname: string) => pathname.startsWith('/lockers/loans') || pathname.startsWith('/lockers/loan/');

const lockerModuleItems: ModuleNavItem[] = [
  { label: 'Escaninhos', href: '/lockers', icon: Box, activeWhen: pathname => pathname.startsWith('/lockers') && !isLockerLoansContext(pathname) },
  { label: 'Alocações', href: '/lockers/loans', icon: ArrowLeftRight, activeWhen: isLockerLoansContext },
];

const lockerSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  campus: z.enum(['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm']),
  location: z.string().min(1, 'Localização é obrigatória'),
  description: z.string().optional(),
});

type LockerFormData = z.infer<typeof lockerSchema>;
type ViewMode = 'map' | 'list';

type LockerGroup = {
  key: string;
  campus: string;
  floor: string;
  side: string;
  lockers: Locker[];
};

const statusLabels = {
  available: { label: 'Disponível', className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', icon: LockOpen },
  occupied: { label: 'Ocupado', className: 'border-amber-400/30 bg-amber-500/10 text-amber-300', icon: Lock },
};

const PAGE_SIZE = 18;

function splitLocation(location: string) {
  const [floor = 'Local não informado', side = 'Sem divisão'] = location.split(' - ').map(part => part.trim());
  return { floor, side };
}

export default function LockersList() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus === 'available' || initialStatus === 'occupied' ? initialStatus : 'all');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);

  const { data: lockers, isLoading } = useLockersList();
  const createLocker = useCreateLocker();
  const updateLocker = useUpdateLocker();
  const deleteLocker = useDeleteLocker();
  const { isAdmin } = useAuth();

  const form = useForm<LockerFormData>({
    resolver: zodResolver(lockerSchema),
    defaultValues: {
      code: '',
      campus: 'Campus I',
      location: '',
      description: '',
    },
  });

  const { uniqueFloors, uniqueSides } = useMemo(() => {
    if (!lockers) return { uniqueFloors: [], uniqueSides: [] };
    const floors = new Set<string>();
    const sides = new Set<string>();
    lockers.forEach(locker => {
      const { floor, side } = splitLocation(locker.location);
      floors.add(floor);
      sides.add(side);
    });
    return {
      uniqueFloors: Array.from(floors).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
      uniqueSides: Array.from(sides).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    };
  }, [lockers]);

  const filteredLockers = useMemo(() => {
    if (!lockers) return [];

    return lockers.filter(locker => {
      if (statusFilter !== 'all' && locker.status !== statusFilter) return false;
      if (campusFilter !== 'all' && locker.campus !== campusFilter) return false;

      const { floor, side } = splitLocation(locker.location);
      if (floorFilter !== 'all' && floor !== floorFilter) return false;
      if (sideFilter !== 'all' && side !== sideFilter) return false;

      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        return (
          locker.code.toLowerCase().includes(search) ||
          locker.location.toLowerCase().includes(search) ||
          locker.campus.toLowerCase().includes(search) ||
          Boolean(locker.description?.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [lockers, statusFilter, campusFilter, floorFilter, sideFilter, searchTerm]);

  const groupedLockers = useMemo<LockerGroup[]>(() => {
    const groups = new Map<string, LockerGroup>();
    filteredLockers.forEach(locker => {
      const { floor, side } = splitLocation(locker.location);
      const key = `${locker.campus}__${floor}__${side}`;
      const existing = groups.get(key);
      if (existing) {
        existing.lockers.push(locker);
      } else {
        groups.set(key, { key, campus: locker.campus, floor, side, lockers: [locker] });
      }
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        lockers: group.lockers.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true })),
      }))
      .sort((a, b) =>
        `${a.campus}-${a.floor}-${a.side}`.localeCompare(`${b.campus}-${b.floor}-${b.side}`, 'pt-BR', { numeric: true })
      );
  }, [filteredLockers]);

  const totalLockers = lockers?.length || 0;
  const availableCount = lockers?.filter(locker => locker.status === 'available').length || 0;
  const occupiedCount = lockers?.filter(locker => locker.status === 'occupied').length || 0;
  const occupiedRate = totalLockers ? Math.round((occupiedCount / totalLockers) * 100) : 0;

  const pageCount = Math.max(1, Math.ceil(filteredLockers.length / PAGE_SIZE));
  const pagedLockers = filteredLockers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, campusFilter, floorFilter, sideFilter, searchTerm]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (selectedLocker && !filteredLockers.some(locker => locker.id === selectedLocker.id)) {
      setSelectedLocker(null);
    }
  }, [filteredLockers, selectedLocker]);

  const onSubmit = async (data: LockerFormData) => {
    if (editingLocker) {
      await updateLocker.mutateAsync({
        id: editingLocker.id,
        code: data.code,
        campus: data.campus,
        location: data.location,
        description: data.description || null,
      });
    } else {
      await createLocker.mutateAsync({
        code: data.code,
        campus: data.campus,
        location: data.location,
        description: data.description || null,
      });
    }
    form.reset();
    setEditingLocker(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (locker: Locker) => {
    setEditingLocker(locker);
    form.reset({
      code: locker.code,
      campus: locker.campus,
      location: locker.location,
      description: locker.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingLocker(null);
      form.reset({ code: '', campus: 'Campus I', location: '', description: '' });
    }
    setIsDialogOpen(open);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCampusFilter('all');
    setFloorFilter('all');
    setSideFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters = statusFilter !== 'all' || campusFilter !== 'all' || floorFilter !== 'all' || sideFilter !== 'all' || searchTerm.trim().length > 0;

  const statCardClass = 'group relative overflow-hidden rounded-2xl border border-border/45 bg-card/70 p-4 text-left shadow-[0_18px_45px_-30px_hsl(var(--primary)/0.45)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  return (
    <MainLayout>
      <div className="relative isolate -m-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-primary/[0.055] via-background/10 to-violet-500/[0.045] p-2 sm:-m-3 sm:p-3">
        <div className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-28 bottom-8 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative space-y-5">
          <ModuleNav title="Escaninhos" description="Gestão de escaninhos e alocações" items={lockerModuleItems} />

          <PageHeader
            title="Escaninhos"
            description="Visualize a ocupação por campus, andar e localização em uma visão rápida e operacional."
            actions={
              <div className="flex flex-wrap gap-2">
                <PdfExportButton
                  title="Relatório de Escaninhos"
                  filename="escaninhos"
                  columns={[
                    { header: 'Código', accessor: 'code' },
                    { header: 'Campus', accessor: 'campus' },
                    { header: 'Localização', accessor: 'location' },
                    { header: 'Status', accessor: (row) => statusLabels[row.status as keyof typeof statusLabels]?.label || row.status },
                  ]}
                  data={lockers || []}
                  filters={[
                    {
                      label: 'Campus',
                      key: 'campus',
                      options: [
                        { label: 'Campus I', value: 'Campus I' },
                        { label: 'Campus II', value: 'Campus II' },
                        { label: 'Campus IV', value: 'Campus IV' },
                        { label: 'Campus HUCM Adm', value: 'Campus HUCM Adm' },
                      ],
                    },
                    {
                      label: 'Status',
                      key: 'status',
                      options: [
                        { label: 'Disponível', value: 'available' },
                        { label: 'Ocupado', value: 'occupied' },
                      ],
                    },
                  ]}
                />

                {isAdmin && (
                  <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                    <DialogTrigger asChild>
                      <Button className="shadow-[0_12px_30px_-16px_hsl(var(--primary)/0.8)]">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Escaninho
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl">
                      <DialogHeader>
                        <DialogTitle>{editingLocker ? 'Editar Escaninho' : 'Cadastrar Escaninho'}</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField control={form.control} name="code" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código *</FormLabel>
                              <FormControl><Input placeholder="Ex: ESC-001" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="campus" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Campus *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="Campus I">Campus I</SelectItem>
                                  <SelectItem value="Campus II">Campus II</SelectItem>
                                  <SelectItem value="Campus IV">Campus IV</SelectItem>
                                  <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="location" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Localização *</FormLabel>
                              <FormControl><Input placeholder="Ex: 2º Andar - Lado A" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descrição</FormLabel>
                              <FormControl><Input placeholder="Descrição adicional" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>Cancelar</Button>
                            <Button type="submit" disabled={createLocker.isPending || updateLocker.isPending}>
                              {createLocker.isPending || updateLocker.isPending ? 'Salvando...' : editingLocker ? 'Salvar' : 'Cadastrar'}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button type="button" className={cn(statCardClass, statusFilter === 'all' && 'border-sky-400/35 bg-sky-500/[0.06]')} onClick={() => setStatusFilter('all')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total de Escaninhos</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{totalLockers}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Base cadastrada</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-500/10 text-sky-300"><Box className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'available' && 'border-emerald-400/40 bg-emerald-500/[0.07]')} onClick={() => setStatusFilter(statusFilter === 'available' ? 'all' : 'available')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Disponíveis</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-emerald-300">{availableCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Prontos para alocação</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"><LockOpen className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'occupied' && 'border-amber-400/40 bg-amber-500/[0.07]')} onClick={() => setStatusFilter(statusFilter === 'occupied' ? 'all' : 'occupied')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Ocupados</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-amber-300">{occupiedCount}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Em uso atualmente</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10 text-amber-300"><Lock className="h-5 w-5" /></div>
              </div>
            </button>

            <button type="button" className={cn(statCardClass, statusFilter === 'occupied' && 'border-primary/35')} onClick={() => setStatusFilter('occupied')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Taxa de Ocupação</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">{occupiedRate}%</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{occupiedCount} de {totalLockers} escaninhos</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Gauge className="h-5 w-5" /></div>
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

              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger><SelectValue placeholder="Andar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Andares</SelectItem>
                  {uniqueFloors.map(floor => <SelectItem key={floor} value={floor}>{floor}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={sideFilter} onValueChange={setSideFilter}>
                <SelectTrigger><SelectValue placeholder="Parte / Lado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Partes</SelectItem>
                  {uniqueSides.map(side => <SelectItem key={side} value={side}>{side}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="available">Disponíveis</SelectItem>
                  <SelectItem value="occupied">Ocupados</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar escaninho..." value={searchTerm} onChange={event => setSearchTerm(event.target.value)} className="pl-9" />
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground">
                  <X className="mr-1 h-3.5 w-3.5" /> Limpar filtros
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
            <Card className="overflow-hidden border-border/45 bg-card/65 shadow-[0_22px_55px_-38px_hsl(var(--primary)/0.6)] backdrop-blur-sm">
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b border-border/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex w-fit rounded-xl border border-border/50 bg-background/30 p-1">
                    <Button type="button" size="sm" variant={viewMode === 'map' ? 'default' : 'ghost'} onClick={() => setViewMode('map')} className="h-8 gap-2 rounded-lg">
                      <LayoutGrid className="h-4 w-4" /> Mapa
                    </Button>
                    <Button type="button" size="sm" variant={viewMode === 'list' ? 'default' : 'ghost'} onClick={() => setViewMode('list')} className="h-8 gap-2 rounded-lg">
                      <List className="h-4 w-4" /> Lista
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" /> Disponível</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,.7)]" /> Ocupado</span>
                    <span>{filteredLockers.length} resultado(s)</span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Carregando escaninhos...</div>
                ) : filteredLockers.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                    <Box className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="font-medium">Nenhum escaninho encontrado</p>
                    <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros para visualizar outros escaninhos.</p>
                  </div>
                ) : viewMode === 'map' ? (
                  <div className="space-y-2 p-3">
                    {groupedLockers.map((group, index) => (
                      <details key={group.key} open={index === 0} className="group rounded-xl border border-border/40 bg-background/20 transition open:bg-background/30">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium hover:bg-primary/[0.035]">
                          <div className="flex min-w-0 items-center gap-2">
                            <Building2 className="h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate">{group.campus}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{group.floor}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{group.side}</span>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{group.lockers.length} escaninho(s)</span>
                        </summary>
                        <div className="grid grid-cols-4 gap-2 border-t border-border/30 p-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                          {group.lockers.map(locker => {
                            const available = locker.status === 'available';
                            return (
                              <button
                                key={locker.id}
                                type="button"
                                onClick={() => setSelectedLocker(locker)}
                                className={cn(
                                  'relative min-h-11 rounded-lg border px-2 text-sm font-semibold tabular-nums transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                                  available
                                    ? 'border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-100 hover:border-emerald-300/70 hover:bg-emerald-500/15'
                                    : 'border-amber-400/35 bg-amber-500/[0.08] text-amber-100 hover:border-amber-300/70 hover:bg-amber-500/15',
                                  selectedLocker?.id === locker.id && 'ring-2 ring-primary/70 shadow-[0_0_24px_hsl(var(--primary)/0.28)]'
                                )}
                              >
                                {locker.code}
                              </button>
                            );
                          })}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 p-3">
                    {pagedLockers.map(locker => {
                      const { floor, side } = splitLocation(locker.location);
                      const config = statusLabels[locker.status];
                      const StatusIcon = config.icon;
                      return (
                        <button
                          key={locker.id}
                          type="button"
                          onClick={() => setSelectedLocker(locker)}
                          className={cn(
                            'grid w-full gap-3 rounded-xl border border-border/40 bg-background/20 p-3 text-left transition hover:border-primary/30 hover:bg-primary/[0.025] md:grid-cols-[100px_minmax(0,1fr)_160px_130px] md:items-center',
                            selectedLocker?.id === locker.id && 'border-primary/45 bg-primary/[0.045]'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg border', config.className)}><StatusIcon className="h-4 w-4" /></div>
                            <span className="font-semibold tabular-nums">{locker.code}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{locker.campus}</p>
                            <p className="truncate text-xs text-muted-foreground">{floor} · {side}</p>
                          </div>
                          <Badge variant="outline" className={cn('w-fit', config.className)}>{config.label}</Badge>
                          <span className="truncate text-xs text-muted-foreground">{locker.description || 'Sem observação'}</span>
                        </button>
                      );
                    })}

                    {pageCount > 1 && (
                      <div className="flex items-center justify-between border-t border-border/30 pt-3">
                        <span className="text-xs text-muted-foreground">Página {page} de {pageCount}</span>
                        <div className="flex gap-1">
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="h-fit border-border/45 bg-card/75 shadow-[0_20px_55px_-38px_hsl(var(--primary)/0.7)] backdrop-blur-md xl:sticky xl:top-20">
              <CardContent className="p-4">
                {!selectedLocker ? (
                  <div className="flex min-h-64 flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><MapPin className="h-5 w-5" /></div>
                    <p className="font-medium">Selecione um escaninho</p>
                    <p className="mt-1 max-w-[220px] text-sm text-muted-foreground">Clique no mapa ou na lista para visualizar detalhes e ações rápidas.</p>
                  </div>
                ) : (() => {
                  const config = statusLabels[selectedLocker.status];
                  const StatusIcon = config.icon;
                  const { floor, side } = splitLocation(selectedLocker.location);
                  return (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Badge variant="outline" className={config.className}><StatusIcon className="mr-1 h-3.5 w-3.5" />{config.label}</Badge>
                          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{selectedLocker.code}</p>
                          <p className="text-sm text-muted-foreground">Escaninho</p>
                        </div>
                        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border', config.className)}><Box className="h-5 w-5" /></div>
                      </div>

                      <div className="space-y-0.5 rounded-xl border border-border/35 bg-background/20 p-3 text-sm">
                        <InfoLine icon={Building2} label="Campus" value={selectedLocker.campus} />
                        <InfoLine icon={Layers3} label="Andar" value={floor} />
                        <InfoLine icon={MapPin} label="Lado / Parte" value={side} />
                        <InfoLine icon={StatusIcon} label="Status" value={config.label} />
                        <InfoLine icon={Edit} label="Observações" value={selectedLocker.description || 'Nenhuma observação'} />
                      </div>

                      <div className="space-y-2">
                        {selectedLocker.status === 'available' ? (
                          <Button asChild className="w-full shadow-[0_12px_30px_-16px_hsl(var(--primary)/0.8)]">
                            <Link to={`/lockers/loan/new?locker=${selectedLocker.id}`}><Plus className="mr-2 h-4 w-4" />Alocar Escaninho</Link>
                          </Button>
                        ) : (
                          <Button asChild className="w-full" variant="outline">
                            <Link to={`/lockers/loans?q=${encodeURIComponent(selectedLocker.code)}`}><ArrowLeftRight className="mr-2 h-4 w-4" />Ver Alocação</Link>
                          </Button>
                        )}

                        {isAdmin && (
                          <>
                            <Button variant="outline" className="w-full" onClick={() => handleEdit(selectedLocker)}><Edit className="mr-2 h-4 w-4" />Editar Escaninho</Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir Escaninho</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>Tem certeza que deseja excluir o escaninho "{selectedLocker.code}"?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => { deleteLocker.mutate(selectedLocker.id); setSelectedLocker(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: typeof Box; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[18px_86px_minmax(0,1fr)] items-start gap-2 border-b border-border/25 py-2 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
