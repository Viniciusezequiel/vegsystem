import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeftRight,
  Ban,
  Boxes,
  Camera,
  CheckCircle2,
  Edit3,
  History,
  Laptop,
  Layers3,
  Loader2,
  MapPin,
  Monitor,
  MoreHorizontal,
  Package,
  Plus,
  Printer,
  Projector,
  Search,
  Trash2,
  Upload,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useEquipmentList, useDeleteEquipment, type Equipment } from '@/hooks/useEquipment';
import {
  useInventoryMovements,
  useCreateTransfer,
  useCreateWriteOff,
  useBulkImportEquipment,
} from '@/hooks/useInventory';
import { useAuth } from '@/contexts/AuthContext';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Constants } from '@/integrations/supabase/types';
import * as XLSX from 'xlsx';
import { EquipmentModuleNav } from '@/components/equipment/EquipmentModuleNav';
import { cn } from '@/lib/utils';

type CampusEnum = 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
type Tone = 'primary' | 'green' | 'blue' | 'amber';

const PAGE_SIZE = 8;

const statusLabels = {
  available: { label: 'Disponível' },
  borrowed: { label: 'Emprestado' },
  maintenance: { label: 'Indisponível' },
};

const toneClasses: Record<Tone, { card: string; icon: string; value: string }> = {
  primary: {
    card: 'border-primary/35 bg-gradient-to-br from-primary/[0.14] via-card/75 to-card/55 shadow-[0_20px_45px_-36px_hsl(var(--primary))]',
    icon: 'bg-primary/15 text-primary ring-primary/20',
    value: 'text-foreground',
  },
  green: {
    card: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.09] via-card/75 to-card/55',
    icon: 'bg-emerald-500/12 text-emerald-400 ring-emerald-500/15',
    value: 'text-emerald-300',
  },
  blue: {
    card: 'border-sky-500/25 bg-gradient-to-br from-sky-500/[0.09] via-card/75 to-card/55',
    icon: 'bg-sky-500/12 text-sky-400 ring-sky-500/15',
    value: 'text-sky-300',
  },
  amber: {
    card: 'border-amber-500/25 bg-gradient-to-br from-amber-500/[0.09] via-card/75 to-card/55',
    icon: 'bg-amber-500/12 text-amber-400 ring-amber-500/15',
    value: 'text-amber-300',
  },
};

function MetricCard({
  label,
  value,
  detail,
  tone,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  tone: Tone;
  icon: React.ReactNode;
}) {
  const classes = toneClasses[tone];
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5', classes.card)}>
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-white/[0.025] blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1', classes.icon)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <p className={cn('mt-0.5 text-2xl font-bold tracking-tight tabular-nums', classes.value)}>{value}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function EquipmentGlyph({ item }: { item: Equipment }) {
  const text = `${item.name} ${item.category || ''}`.toLowerCase();
  const className = 'h-6 w-6';
  if (text.includes('notebook') || text.includes('laptop')) return <Laptop className={className} />;
  if (text.includes('monitor') || text.includes('tela')) return <Monitor className={className} />;
  if (text.includes('projetor')) return <Projector className={className} />;
  if (text.includes('camera') || text.includes('câmera')) return <Camera className={className} />;
  if (text.includes('impressora')) return <Printer className={className} />;
  return <Package className={className} />;
}

function StatusPill({ item }: { item: Equipment }) {
  if (item.status === 'maintenance') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
        <Wrench className="h-3.5 w-3.5" /> Indisponível
      </span>
    );
  }
  if (item.status === 'borrowed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-300">
        <Users className="h-3.5 w-3.5" /> Emprestado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" /> Disponível
    </span>
  );
}

export default function EquipmentList() {
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [deleteEquipmentTarget, setDeleteEquipmentTarget] = useState<Equipment | null>(null);
  const [importData, setImportData] = useState<any[]>([]);

  const { data: equipment = [], isLoading } = useEquipmentList();
  const { data: movements, isLoading: movementsLoading } = useInventoryMovements();
  const deleteEquipment = useDeleteEquipment();
  const createTransfer = useCreateTransfer();
  const createWriteOff = useCreateWriteOff();
  const bulkImport = useBulkImportEquipment();
  const { isAdmin } = useAuth();

  const [transferData, setTransferData] = useState({
    to_location: '',
    to_campus: '' as CampusEnum | '',
    reason: '',
    notes: '',
  });

  const [writeOffData, setWriteOffData] = useState({ reason: '', notes: '' });

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((item) => item.category).filter(Boolean) as string[])).sort(),
    [equipment]
  );

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch = !query || [
        item.name,
        item.patrimony_code,
        item.old_patrimony_code || '',
        item.category || '',
        item.location,
        item.campus,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesCampus = campusFilter === 'all' || item.campus === campusFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesCampus && matchesCategory && matchesStatus;
    });
  }, [equipment, search, campusFilter, categoryFilter, statusFilter]);

  const totals = useMemo(() => {
    const total = equipment.reduce((sum, item) => sum + Math.max(item.quantity || 0, 0), 0);
    const available = equipment.reduce((sum, item) => sum + Math.max(item.available_quantity || 0, 0), 0);
    const maintenance = equipment
      .filter((item) => item.status === 'maintenance')
      .reduce((sum, item) => sum + Math.max(item.quantity || 0, 0), 0);
    const borrowed = equipment.reduce(
      (sum, item) => sum + Math.max((item.quantity || 0) - (item.available_quantity || 0), 0),
      0
    );
    return { total, available, borrowed, maintenance };
  }, [equipment]);

  const pageCount = Math.max(1, Math.ceil(filteredEquipment.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedEquipment = filteredEquipment.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, campusFilter, categoryFilter, statusFilter]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const hasFilters = search || campusFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all';

  const handleDelete = (id: string) => deleteEquipment.mutate(id);

  const handleTransfer = async () => {
    if (!selectedEquipment || !transferData.to_location || !transferData.to_campus) return;
    await createTransfer.mutateAsync({
      equipment_id: selectedEquipment.id,
      from_location: selectedEquipment.location,
      to_location: transferData.to_location,
      from_campus: selectedEquipment.campus,
      to_campus: transferData.to_campus,
      quantity: 1,
      reason: transferData.reason,
      notes: transferData.notes,
    });
    setTransferDialogOpen(false);
    setSelectedEquipment(null);
    setTransferData({ to_location: '', to_campus: '', reason: '', notes: '' });
  };

  const handleWriteOff = async () => {
    if (!selectedEquipment || !writeOffData.reason) return;
    await createWriteOff.mutateAsync({
      equipment_id: selectedEquipment.id,
      reason: writeOffData.reason,
      notes: writeOffData.notes,
    });
    setWriteOffDialogOpen(false);
    setSelectedEquipment(null);
    setWriteOffData({ reason: '', notes: '' });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      setImportData(XLSX.utils.sheet_to_json(sheet));
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!importData.length) return;
    const formattedData = importData.map((row: any) => ({
      name: row['Nome'] || row['name'] || '',
      patrimony_code: String(row['Patrimônio Novo'] || row['Patrimônio'] || row['patrimony_code'] || row['Codigo'] || ''),
      old_patrimony_code: row['Patrimônio Antigo'] || row['old_patrimony_code'] || null,
      location: row['Localização'] || row['location'] || '',
      campus: (row['Campus'] || row['campus'] || 'Campus I') as CampusEnum,
      quantity: Number(row['Quantidade'] || row['quantity'] || 1),
      category: row['Categoria'] || row['category'],
      description: row['Descrição'] || row['description'],
      allow_external_loan: false,
    }));
    await bulkImport.mutateAsync(formattedData);
    setImportDialogOpen(false);
    setImportData([]);
  };

  const movementBadge = (type: string) => {
    const classes: Record<string, string> = {
      transfer: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
      write_off: 'border-red-500/20 bg-red-500/10 text-red-300',
      import: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
      adjustment: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    };
    const labels: Record<string, string> = {
      transfer: 'Transferência',
      write_off: 'Baixa',
      import: 'Importação',
      adjustment: 'Ajuste',
    };
    return <Badge variant="outline" className={classes[type]}>{labels[type] || type}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <EquipmentModuleNav />

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <MetricCard label="Total cadastrados" value={totals.total} detail={`${equipment.length} registros no inventário`} tone="primary" icon={<Boxes className="h-5 w-5" />} />
          <MetricCard label="Disponíveis" value={totals.available} detail="unidades prontas para empréstimo" tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
          <MetricCard label="Emprestados" value={totals.borrowed} detail="unidades atualmente em circulação" tone="blue" icon={<Users className="h-5 w-5" />} />
          <MetricCard label="Indisponíveis" value={totals.maintenance} detail="itens em baixa ou indisponíveis" tone="amber" icon={<Wrench className="h-5 w-5" />} />
        </div>

        <Tabs defaultValue="inventory" className="space-y-3">
          <div className="rounded-2xl border border-border/45 bg-card/55 p-3 shadow-[0_18px_55px_-46px_rgba(0,0,0,.8)]">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">
                <div className="relative min-w-0 flex-1 lg:max-w-[520px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nome, patrimônio, categoria ou local..."
                    className="h-10 border-border/45 bg-background/30 pl-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
                  <Select value={campusFilter} onValueChange={setCampusFilter}>
                    <SelectTrigger className="h-10 w-full bg-background/30 lg:w-[160px]"><SelectValue placeholder="Campus" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os campus</SelectItem>
                      {Constants.public.Enums.campus_enum.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 w-full bg-background/30 lg:w-[160px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-full bg-background/30 lg:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="available">Disponíveis</SelectItem>
                      <SelectItem value="borrowed">Emprestados</SelectItem>
                      <SelectItem value="maintenance">Indisponíveis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setCampusFilter('all');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                    }}
                    className="h-9 text-muted-foreground"
                  >
                    <X className="mr-1 h-4 w-4" /> Limpar
                  </Button>
                )}

                <PdfExportButton
                  title="Relatório de Patrimônios"
                  filename="patrimonios"
                  columns={[
                    { header: 'Nome', accessor: 'name' },
                    { header: 'Patrimônio Novo', accessor: 'patrimony_code' },
                    { header: 'Patrimônio Antigo', accessor: (row) => row.old_patrimony_code || '—' },
                    { header: 'Qtd. Total', accessor: (row) => String(row.quantity) },
                    { header: 'Disponível', accessor: (row) => String(row.available_quantity) },
                    { header: 'Campus', accessor: 'campus' },
                    { header: 'Local', accessor: 'location' },
                    { header: 'Status', accessor: (row) => statusLabels[row.status as keyof typeof statusLabels]?.label || row.status },
                  ]}
                  data={filteredEquipment}
                />

                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-9"><Upload className="mr-2 h-4 w-4" /> Importar</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Importar patrimônios</DialogTitle>
                      <DialogDescription>Faça upload de uma planilha Excel com os patrimônios.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="rounded-xl border-2 border-dashed border-border/70 p-8 text-center">
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" id="equipment-file-upload" />
                        <label htmlFor="equipment-file-upload" className="cursor-pointer">
                          <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
                          <p className="mt-2 text-xs text-muted-foreground">Nome, Patrimônio, Localização, Campus, Quantidade e Categoria.</p>
                        </label>
                      </div>

                      {importData.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{importData.length} itens encontrados</p>
                          <div className="max-h-48 overflow-auto rounded-lg border border-border/60">
                            <Table>
                              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Patrimônio</TableHead><TableHead>Campus</TableHead></TableRow></TableHeader>
                              <TableBody>
                                {importData.slice(0, 5).map((row: any, index) => (
                                  <TableRow key={index}><TableCell>{row['Nome'] || row['name']}</TableCell><TableCell>{row['Patrimônio'] || row['patrimony_code']}</TableCell><TableCell>{row['Campus'] || row['campus']}</TableCell></TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleImport} disabled={!importData.length || bulkImport.isPending}>
                          {bulkImport.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</> : `Importar ${importData.length} itens`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button asChild className="h-9 shadow-[0_0_28px_-14px_hsl(var(--primary))]">
                  <Link to="/equipment/register"><Plus className="mr-2 h-4 w-4" /> Novo Patrimônio</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl border border-border/45 bg-card/55 p-1 sm:w-[320px]">
              <TabsTrigger value="inventory" className="gap-2 rounded-lg"><Layers3 className="h-4 w-4" /> Inventário</TabsTrigger>
              <TabsTrigger value="movements" className="gap-2 rounded-lg"><History className="h-4 w-4" /> Movimentações</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">{filteredEquipment.length} registro(s) encontrado(s)</p>
          </div>

          <TabsContent value="inventory" className="mt-0 space-y-3">
            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/40 bg-card/45">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : paginatedEquipment.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/35 px-5 py-14 text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground/45" />
                <p className="mt-3 text-sm font-medium">Nenhum patrimônio encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou cadastre um novo item.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedEquipment.map((item) => {
                  const borrowable = item.available_quantity > 0 && item.status !== 'maintenance';
                  return (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/55 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/70 hover:shadow-[0_18px_45px_-38px_hsl(var(--primary))]"
                    >
                      <div className={cn('pointer-events-none absolute bottom-0 left-0 top-0 w-0.5', item.status === 'available' ? 'bg-emerald-400' : item.status === 'borrowed' ? 'bg-sky-400' : 'bg-amber-400')} />

                      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(240px,1.4fr)_minmax(150px,.75fr)] xl:grid-cols-[minmax(270px,1.45fr)_minmax(150px,.72fr)_minmax(210px,.95fr)_minmax(190px,.8fr)_auto] xl:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-gradient-to-br from-primary/15 to-background/30 text-primary shadow-inner">
                            <EquipmentGlyph item={item} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                              {item.category && <span className="rounded-md border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[9px] font-medium text-primary">{item.category}</span>}
                            </div>
                            <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.description || 'Item do inventário institucional'}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                          <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/65">Patrimônio</p>
                          <p className="mt-0.5 truncate text-xs font-semibold tabular-nums text-foreground">{item.patrimony_code}</p>
                          {item.old_patrimony_code && <p className="mt-0.5 truncate text-[9px] text-muted-foreground">Antigo: {item.old_patrimony_code}</p>}
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/20 px-3 py-2 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0">
                          <MapPin className="h-4 w-4 shrink-0 text-primary/75" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">{item.campus}</p>
                            <p className="truncate text-[10px] text-muted-foreground">{item.location}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 xl:block">
                          <StatusPill item={item} />
                          <p className="mt-0 xl:mt-1 text-[9px] text-muted-foreground">{item.available_quantity}/{item.quantity} disponível(is)</p>
                        </div>

                        <div className="flex items-center justify-end gap-1.5">
                          {borrowable && (
                            <Button asChild variant="outline" size="sm" className="h-8 border-primary/20 bg-primary/[0.04] text-[10px] hover:bg-primary/10">
                              <Link to={`/equipment/loan/new?equipment=${item.id}`}><ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Emprestar</Link>
                            </Button>
                          )}

                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20" title="Editar patrimônio">
                            <Link to={`/equipment/edit/${item.id}`}><Edit3 className="h-3.5 w-3.5" /></Link>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-border/35 bg-background/20" aria-label={`Mais ações para ${item.name}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => { setSelectedEquipment(item); setTransferDialogOpen(true); }} disabled={item.status === 'maintenance'}>
                                <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferir
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { setSelectedEquipment(item); setWriteOffDialogOpen(true); }} disabled={item.status === 'maintenance'}>
                                <Ban className="mr-2 h-4 w-4" /> Dar baixa
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onSelect={() => setDeleteEquipmentTarget(item)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {pageCount > 1 && (
              <div className="flex flex-col gap-2 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[10px] text-muted-foreground">Página {currentPage} de {pageCount}</p>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Anterior</Button>
                  <span className="min-w-9 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1.5 text-center text-xs font-semibold text-primary">{currentPage}</span>
                  <Button variant="outline" size="sm" className="h-8" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Próxima</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="movements" className="mt-0">
            <div className="overflow-hidden rounded-2xl border border-border/45 bg-card/55">
              <div className="border-b border-border/35 px-4 py-3">
                <h2 className="text-sm font-semibold">Histórico de movimentações</h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Transferências, baixas, importações e ajustes.</p>
              </div>
              {movementsLoading ? (
                <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Patrimônio</TableHead><TableHead>De</TableHead><TableHead>Para</TableHead><TableHead>Motivo</TableHead><TableHead>Realizado por</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {movements?.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="whitespace-nowrap text-xs">{format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell>{movementBadge(movement.movement_type)}</TableCell>
                          <TableCell className="font-medium">{movement.equipment?.name}<span className="block text-[10px] text-muted-foreground">{movement.equipment?.patrimony_code}</span></TableCell>
                          <TableCell>{movement.from_location || '—'}{movement.from_campus && <span className="block text-[10px] text-muted-foreground">{movement.from_campus}</span>}</TableCell>
                          <TableCell>{movement.to_location || '—'}{movement.to_campus && <span className="block text-[10px] text-muted-foreground">{movement.to_campus}</span>}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{movement.reason || '—'}</TableCell>
                          <TableCell>{movement.performed_by_name || '—'}</TableCell>
                        </TableRow>
                      ))}
                      {!movements?.length && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma movimentação registrada.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!deleteEquipmentTarget} onOpenChange={(open) => !open && setDeleteEquipmentTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir{deleteEquipmentTarget ? ` “${deleteEquipmentTarget.name}”` : ''}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteEquipmentTarget) { handleDelete(deleteEquipmentTarget.id); setDeleteEquipmentTarget(null); } }}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar transferência</DialogTitle>
              <DialogDescription>Transferir {selectedEquipment?.name} ({selectedEquipment?.patrimony_code}).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-border/45 bg-muted/20 p-3 text-sm">
                <span className="text-muted-foreground">Local atual:</span> <span className="font-medium">{selectedEquipment?.location}</span> <span className="text-muted-foreground">({selectedEquipment?.campus})</span>
              </div>
              <div className="space-y-2"><Label>Novo local *</Label><Input placeholder="Ex: Sala 101" value={transferData.to_location} onChange={(event) => setTransferData({ ...transferData, to_location: event.target.value })} /></div>
              <div className="space-y-2">
                <Label>Novo campus *</Label>
                <Select value={transferData.to_campus} onValueChange={(value) => setTransferData({ ...transferData, to_campus: value as CampusEnum })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                  <SelectContent>{Constants.public.Enums.campus_enum.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Motivo</Label><Input placeholder="Ex: Remanejamento de setor" value={transferData.reason} onChange={(event) => setTransferData({ ...transferData, reason: event.target.value })} /></div>
              <div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Observações adicionais..." value={transferData.notes} onChange={(event) => setTransferData({ ...transferData, notes: event.target.value })} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Cancelar</Button><Button onClick={handleTransfer} disabled={!transferData.to_location || !transferData.to_campus || createTransfer.isPending}>{createTransfer.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Confirmar transferência'}</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar baixa</DialogTitle>
              <DialogDescription>Dar baixa em {selectedEquipment?.name} ({selectedEquipment?.patrimony_code}).</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">Esta ação marcará o patrimônio como indisponível para uso e empréstimos.</div>
              <div className="space-y-2">
                <Label>Motivo da baixa *</Label>
                <Select value={writeOffData.reason} onValueChange={(value) => setWriteOffData({ ...writeOffData, reason: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Depreciação/Fim de vida útil">Depreciação/Fim de vida útil</SelectItem><SelectItem value="Dano irreparável">Dano irreparável</SelectItem><SelectItem value="Furto/Roubo">Furto/Roubo</SelectItem><SelectItem value="Extravio">Extravio</SelectItem><SelectItem value="Doação">Doação</SelectItem><SelectItem value="Venda">Venda</SelectItem><SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Detalhes adicionais sobre a baixa..." value={writeOffData.notes} onChange={(event) => setWriteOffData({ ...writeOffData, notes: event.target.value })} rows={3} /></div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setWriteOffDialogOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleWriteOff} disabled={!writeOffData.reason || createWriteOff.isPending}>{createWriteOff.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : 'Confirmar baixa'}</Button></div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
