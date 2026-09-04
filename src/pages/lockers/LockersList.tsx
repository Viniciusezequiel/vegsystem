import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Box, ArrowLeftRight, Edit, Trash2, Search, X } from 'lucide-react';
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

const statusLabels = {
  available: { label: 'Disponível', variant: 'default' as const },
  occupied: { label: 'Ocupado', variant: 'secondary' as const },
};

export default function LockersList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null);
  const { data: lockers, isLoading } = useLockersList(
    statusFilter === 'all' ? undefined : statusFilter as 'available' | 'occupied'
  );
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

  // Extract unique floors and sides from lockers
  const { uniqueFloors, uniqueSides } = useMemo(() => {
    if (!lockers) return { uniqueFloors: [], uniqueSides: [] };
    const floors = new Set<string>();
    const sides = new Set<string>();
    lockers.forEach(locker => {
      const parts = locker.location.split(' - ');
      if (parts.length >= 1 && parts[0]) floors.add(parts[0]);
      if (parts.length >= 2 && parts[1]) sides.add(parts[1]);
    });
    return {
      uniqueFloors: Array.from(floors).sort(),
      uniqueSides: Array.from(sides).sort(),
    };
  }, [lockers]);

  const filteredLockers = useMemo(() => {
    if (!lockers) return [];
    
    return lockers.filter(locker => {
      // Campus filter
      if (campusFilter !== 'all' && locker.campus !== campusFilter) return false;
      
      // Floor filter (first part of location)
      if (floorFilter !== 'all') {
        const parts = locker.location.split(' - ');
        if (!parts[0]?.includes(floorFilter)) return false;
      }
      
      // Side filter (second part of location)
      if (sideFilter !== 'all') {
        const parts = locker.location.split(' - ');
        if (!parts[1]?.includes(sideFilter)) return false;
      }
      
      // Search term
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase();
        return (
          locker.code.toLowerCase().includes(search) ||
          locker.location.toLowerCase().includes(search) ||
          locker.campus.toLowerCase().includes(search) ||
          (locker.description?.toLowerCase().includes(search))
        );
      }
      
      return true;
    });
  }, [lockers, searchTerm, campusFilter, floorFilter, sideFilter]);

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

  const handleDelete = (id: string) => {
    deleteLocker.mutate(id);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingLocker(null);
      form.reset({
        code: '',
        campus: 'Campus I',
        location: '',
        description: '',
      });
    }
    setIsDialogOpen(open);
  };

  const availableCount = lockers?.filter(l => l.status === 'available').length || 0;
  const occupiedCount = lockers?.filter(l => l.status === 'occupied').length || 0;
  const totalLockers = lockers?.length || 0;

  const availableRate = totalLockers
    ? Math.round((availableCount / totalLockers) * 100)
    : 0;

  const occupiedRate = totalLockers
    ? Math.round((occupiedCount / totalLockers) * 100)
    : 0;

  const hasActiveFilters =
    statusFilter !== 'all' ||
    campusFilter !== 'all' ||
    floorFilter !== 'all' ||
    sideFilter !== 'all' ||
    searchTerm.trim().length > 0;

  const clearFilters = () => {
    setStatusFilter('all');
    setCampusFilter('all');
    setFloorFilter('all');
    setSideFilter('all');
    setSearchTerm('');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <ModuleNav title="Escaninhos" description="Gestão de escaninhos e alocações" items={lockerModuleItems} />

        <PageHeader
          title="Gestão de Escaninhos"
          description="Visualize disponibilidade, ocupação e localização dos escaninhos"
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
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Escaninho
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingLocker ? 'Editar Escaninho' : 'Cadastrar Escaninho'}
                    </DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Código *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: ESC-001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="campus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Campus *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Campus I">Campus I</SelectItem>
                                <SelectItem value="Campus II">Campus II</SelectItem>
                                <SelectItem value="Campus IV">Campus IV</SelectItem>
                                <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Localização *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Bloco A, Corredor 1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                              <Input placeholder="Descrição adicional" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createLocker.isPending || updateLocker.isPending}>
                          {createLocker.isPending || updateLocker.isPending 
                            ? 'Salvando...' 
                            : editingLocker ? 'Salvar' : 'Cadastrar'}
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="border-border/60 bg-card/65">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Total de Escaninhos
              </p>
              <div className="mt-1 text-2xl font-semibold text-foreground">
                {totalLockers}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                Base cadastrada
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/65">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Disponíveis
              </p>
              <div className="mt-1 text-2xl font-semibold text-emerald-400">
                {availableCount}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                {availableRate}% dos escaninhos livres
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/65">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Ocupados
              </p>
              <div className="mt-1 text-2xl font-semibold text-amber-400">
                {occupiedCount}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/80">
                {occupiedRate}% atualmente em uso
              </p>
            </CardContent>
          </Card>
        </div>

        <PageToolbar>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, local ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="occupied">Ocupados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="w-full lg:w-[165px]">
                <SelectValue placeholder="Campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Campus</SelectItem>
                <SelectItem value="Campus I">Campus I</SelectItem>
                <SelectItem value="Campus II">Campus II</SelectItem>
                <SelectItem value="Campus IV">Campus IV</SelectItem>
                <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
              </SelectContent>
            </Select>

            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-full lg:w-[155px]">
                <SelectValue placeholder="Andar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Andares</SelectItem>
                {uniqueFloors.map(floor => (
                  <SelectItem key={floor} value={floor}>{floor}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sideFilter} onValueChange={setSideFilter}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue placeholder="Parte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Partes</SelectItem>
                {uniqueSides.map(side => (
                  <SelectItem key={side} value={side}>{side}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="mr-1 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </PageToolbar>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Box className="h-4 w-4 text-primary" />
                  Escaninhos
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Consulte disponibilidade e localização
                </p>
              </div>

              <span className="shrink-0 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground">
                {filteredLockers.length} registro(s)
              </span>
            </div>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredLockers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Nenhum escaninho encontrado com essa busca' : 'Nenhum escaninho encontrado'}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredLockers.map((locker) => (
                    <Card
                      key={locker.id}
                      className={cn(
                        'transition-colors hover:border-primary/30',
                        locker.status === 'occupied' &&
                          'border-amber-500/25 bg-amber-500/[0.035]'
                      )}
                    >
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-lg">{locker.code}</div>
                          <Badge variant={statusLabels[locker.status].variant}>
                            {statusLabels[locker.status].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{locker.campus}</p>
                        <p className="text-sm text-muted-foreground mb-4">{locker.location}</p>
                        <div className="flex gap-2">
                          {locker.status === 'available' && (
                            <Button asChild size="sm" className="flex-1">
                              <Link to={`/lockers/loan/new?locker=${locker.id}`}>
                                Emprestar
                              </Link>
                            </Button>
                          )}
                          {isAdmin && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEdit(locker)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o escaninho "{locker.code}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(locker.id)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
