import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Calendar, 
  Package, 
  Box, 
  ClipboardCheck,
  Download,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Users,
  Clock
} from 'lucide-react';
import { useEquipmentList, useEquipmentLoans } from '@/hooks/useEquipment';
import { useLockersList, useLockerLoans } from '@/hooks/useLockers';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Constants } from '@/integrations/supabase/types';
import { format, subDays, subMonths, subWeeks, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  active: 'Ativo',
  returned: 'Devolvido',
  overdue: 'Atrasado',
  available: 'Disponível',
  borrowed: 'Emprestado',
  maintenance: 'Manutenção',
  occupied: 'Ocupado',
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const { data: equipment } = useEquipmentList();
  const { data: equipmentLoansActive } = useEquipmentLoans('active');
  const { data: equipmentLoansReturned } = useEquipmentLoans('returned');
  const { data: lockers } = useLockersList();
  const { data: lockerLoansActive } = useLockerLoans('active');
  const { data: lockerLoansReturned } = useLockerLoans('returned');

  // Combine loans data
  const allEquipmentLoans = useMemo(() => [
    ...(equipmentLoansActive || []),
    ...(equipmentLoansReturned || [])
  ], [equipmentLoansActive, equipmentLoansReturned]);

  const allLockerLoans = useMemo(() => [
    ...(lockerLoansActive || []),
    ...(lockerLoansReturned || [])
  ], [lockerLoansActive, lockerLoansReturned]);

  // Date range calculation
  const effectiveStartDate = useMemo(() => {
    if (dateRange === 'custom') return startDate ? parseISO(startDate) : null;
    const now = new Date();
    switch (dateRange) {
      case 'week': return subWeeks(now, 1);
      case 'month': return subMonths(now, 1);
      case 'quarter': return subMonths(now, 3);
      case 'year': return subMonths(now, 12);
      default: return subMonths(now, 1);
    }
  }, [dateRange, startDate]);

  const effectiveEndDate = useMemo(() => {
    if (dateRange === 'custom') return endDate ? parseISO(endDate) : null;
    return new Date();
  }, [dateRange, endDate]);

  // Stats calculations
  const stats = useMemo(() => ({
    equipment: {
      total: equipment?.length || 0,
      available: equipment?.filter(e => e.status === 'available').length || 0,
      borrowed: equipment?.filter(e => e.status === 'borrowed').length || 0,
    },
    lockers: {
      total: lockers?.length || 0,
      available: lockers?.filter(l => l.status === 'available').length || 0,
      occupied: lockers?.filter(l => l.status === 'occupied').length || 0,
    },
    loans: {
      equipmentActive: equipmentLoansActive?.length || 0,
      lockerActive: lockerLoansActive?.length || 0,
    }
  }), [equipment, lockers, equipmentLoansActive, lockerLoansActive]);

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Relatórios</h1>
        </div>
        <p className="page-subtitle">Visualize e exporte dados de todos os módulos do sistema</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Box className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.equipment.total}</p>
                <p className="text-xs text-muted-foreground">Equipamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Package className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.lockers.total}</p>
                <p className="text-xs text-muted-foreground">Escaninhos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.loans.equipmentActive + stats.loans.lockerActive}</p>
                <p className="text-xs text-muted-foreground">Empréstimos Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Data inicial</Label>
                  <DatePickerInput
                    value={startDate}
                    onChange={setStartDate}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data final</Label>
                  <DatePickerInput
                    value={endDate}
                    onChange={setEndDate}
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Campus</Label>
              <Select value={campusFilter} onValueChange={setCampusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  {Constants.public.Enums.campus_enum.map((campus) => (
                    <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos resultados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="equipment" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="equipment" className="gap-2 py-3">
            <Box className="w-4 h-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="lockers" className="gap-2 py-3">
            <Package className="w-4 h-4" />
            Escaninhos
          </TabsTrigger>
          <TabsTrigger value="loans" className="gap-2 py-3">
            <Clock className="w-4 h-4" />
            Empréstimos
          </TabsTrigger>
        </TabsList>

        {/* Equipment Tab */}
        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Box className="w-5 h-5 text-primary" />
                    Relatório de Equipamentos
                  </CardTitle>
                  <CardDescription>
                    {equipment?.length || 0} equipamentos cadastrados
                  </CardDescription>
                </div>
                <PdfExportButton
                  title="Relatório de Equipamentos"
                  filename={`equipamentos-${format(new Date(), 'yyyy-MM-dd')}`}
                  columns={[
                    { header: 'Nome', accessor: 'name' },
                    { header: 'Patrimônio', accessor: 'patrimony_code' },
                    { header: 'Campus', accessor: 'campus' },
                    { header: 'Local', accessor: 'location' },
                    { header: 'Qtd. Total', accessor: (r) => String(r.quantity) },
                    { header: 'Disponível', accessor: (r) => String(r.available_quantity) },
                    { header: 'Status', accessor: (r) => statusLabels[r.status as keyof typeof statusLabels] || r.status },
                  ]}
                  data={equipment || []}
                  filters={[
                    {
                      label: 'Campus',
                      key: 'campus',
                      options: Constants.public.Enums.campus_enum.map(c => ({ label: c, value: c })),
                    },
                    {
                      label: 'Status',
                      key: 'status',
                      options: [
                        { label: 'Disponível', value: 'available' },
                        { label: 'Emprestado', value: 'borrowed' },
                        { label: 'Manutenção', value: 'maintenance' },
                      ],
                    },
                  ]}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-green-500">{stats.equipment.available}</p>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-amber-500">{stats.equipment.borrowed}</p>
                  <p className="text-sm text-muted-foreground">Emprestados</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.equipment.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lockers Tab */}
        <TabsContent value="lockers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Relatório de Escaninhos
                  </CardTitle>
                  <CardDescription>
                    {lockers?.length || 0} escaninhos cadastrados
                  </CardDescription>
                </div>
                <PdfExportButton
                  title="Relatório de Escaninhos"
                  filename={`escaninhos-${format(new Date(), 'yyyy-MM-dd')}`}
                  columns={[
                    { header: 'Código', accessor: 'code' },
                    { header: 'Campus', accessor: 'campus' },
                    { header: 'Localização', accessor: 'location' },
                    { header: 'Status', accessor: (r) => statusLabels[r.status as keyof typeof statusLabels] || r.status },
                  ]}
                  data={lockers || []}
                  filters={[
                    {
                      label: 'Campus',
                      key: 'campus',
                      options: Constants.public.Enums.campus_enum.map(c => ({ label: c, value: c })),
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-green-500">{stats.lockers.available}</p>
                  <p className="text-sm text-muted-foreground">Disponíveis</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-amber-500">{stats.lockers.occupied}</p>
                  <p className="text-sm text-muted-foreground">Ocupados</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.lockers.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loans Tab */}
        <TabsContent value="loans">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Box className="w-5 h-5 text-primary" />
                      Empréstimos de Equipamentos
                    </CardTitle>
                    <CardDescription>
                      {allEquipmentLoans.length} empréstimos registrados
                    </CardDescription>
                  </div>
                  <PdfExportButton
                    title="Relatório de Empréstimos de Equipamentos"
                    filename={`emprestimos-equipamentos-${format(new Date(), 'yyyy-MM-dd')}`}
                    columns={[
                      { header: 'Equipamento', accessor: (r) => r.equipment?.name || 'N/A' },
                      { header: 'Patrimônio', accessor: (r) => r.equipment?.patrimony_code || 'N/A' },
                      { header: 'Solicitante', accessor: 'borrower_name' },
                      { header: 'Setor', accessor: 'borrower_sector' },
                      { header: 'Telefone', accessor: 'borrower_phone' },
                      { header: 'Prev. Devolução', accessor: (r) => format(parseISO(r.expected_return_date), 'dd/MM/yyyy') },
                      { header: 'Status', accessor: (r) => statusLabels[r.status as keyof typeof statusLabels] || r.status },
                    ]}
                    data={allEquipmentLoans}
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-amber-500">{stats.loans.equipmentActive}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-green-500">{equipmentLoansReturned?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Devolvidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Alocações de Escaninhos
                    </CardTitle>
                    <CardDescription>
                      {allLockerLoans.length} alocações registradas
                    </CardDescription>
                  </div>
                  <PdfExportButton
                    title="Relatório de Alocações de Escaninhos"
                    filename={`alocacoes-escaninhos-${format(new Date(), 'yyyy-MM-dd')}`}
                    columns={[
                      { header: 'Escaninho', accessor: (r) => r.locker?.code || 'N/A' },
                      { header: 'Campus', accessor: (r) => r.locker?.campus || 'N/A' },
                      { header: 'Cliente', accessor: 'borrower_name' },
                      { header: 'Telefone', accessor: 'borrower_phone' },
                      { header: 'Email', accessor: (r) => r.borrower_email || '-' },
                      { header: 'Prev. Devolução', accessor: (r) => format(parseISO(r.expected_return_date), 'dd/MM/yyyy') },
                      { header: 'Status', accessor: (r) => statusLabels[r.status as keyof typeof statusLabels] || r.status },
                    ]}
                    data={allLockerLoans}
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
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-amber-500">{stats.loans.lockerActive}</p>
                    <p className="text-sm text-muted-foreground">Ativos</p>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/50 text-center">
                    <p className="text-2xl font-bold text-green-500">{lockerLoansReturned?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Devolvidos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
