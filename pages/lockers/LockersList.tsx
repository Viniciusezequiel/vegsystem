import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
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
import { Plus, Box, ArrowRight, Edit, Trash2, Search } from 'lucide-react';
import { useLockersList, useCreateLocker, useUpdateLocker, useDeleteLocker, Locker } from '@/hooks/useLockers';
import { useAuth } from '@/contexts/AuthContext';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Escaninhos</h1>
            <p className="text-muted-foreground">Visualize e gerencie os escaninhos</p>
          </div>
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
            <Button asChild variant="outline">
              <Link to="/lockers/loans">
                <ArrowRight className="mr-2 h-4 w-4" />
                Empréstimos
              </Link>
            </Button>
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{lockers?.length || 0}</div>
              <p className="text-muted-foreground">Total de Escaninhos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{availableCount}</div>
              <p className="text-muted-foreground">Disponíveis</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-amber-600">{occupiedCount}</div>
              <p className="text-muted-foreground">Ocupados</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5" />
                  Escaninhos
                </CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Disponíveis</SelectItem>
                    <SelectItem value="occupied">Ocupados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <Select value={campusFilter} onValueChange={setCampusFilter}>
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Parte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Partes</SelectItem>
                    {uniqueSides.map(side => (
                      <SelectItem key={side} value={side}>{side}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
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
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredLockers.length} escaninho(s) encontrado(s)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredLockers.map((locker) => (
                    <Card key={locker.id} className={locker.status === 'occupied' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : ''}>
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