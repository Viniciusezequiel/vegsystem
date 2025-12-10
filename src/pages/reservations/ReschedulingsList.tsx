import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useReschedulings, useTodayReschedulings } from '@/hooks/useReschedulings';
import { useReservationRooms } from '@/hooks/useReservations';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Calendar, MapPin, ArrowRight, Filter, Clock, Users, Search, CalendarDays } from 'lucide-react';

export default function ReschedulingsList() {
  const [activeTab, setActiveTab] = useState('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [recurringFilter, setRecurringFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: rooms = [] } = useReservationRooms();

  // Calculate date ranges based on active tab
  const getDateRange = () => {
    const now = new Date();
    switch (activeTab) {
      case 'today':
        return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
      case 'week':
        return { dateFrom: startOfWeek(now, { locale: ptBR }).toISOString(), dateTo: endOfWeek(now, { locale: ptBR }).toISOString() };
      case 'month':
        return { dateFrom: startOfMonth(now).toISOString(), dateTo: endOfMonth(now).toISOString() };
      case 'custom':
        return { 
          dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          dateTo: dateTo ? new Date(dateTo).toISOString() : undefined
        };
      default:
        return {};
    }
  };

  const filters = {
    ...getDateRange(),
    roomId: selectedRoom || undefined,
    isRecurring: recurringFilter === 'recurring' ? true : recurringFilter === 'single' ? false : undefined,
  };

  const { data: reschedulings = [], isLoading } = useReschedulings(
    activeTab === 'all' ? {} : filters
  );
  const { data: todayReschedulings = [] } = useTodayReschedulings();

  const filteredReschedulings = reschedulings.filter(r => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      r.reservations?.title?.toLowerCase().includes(search) ||
      r.reservations?.requester_name?.toLowerCase().includes(search) ||
      r.original_room?.name?.toLowerCase().includes(search) ||
      r.new_room?.name?.toLowerCase().includes(search) ||
      r.reason?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: reschedulings.length,
    today: todayReschedulings.length,
    recurring: reschedulings.filter(r => r.is_recurring_update).length,
    single: reschedulings.filter(r => !r.is_recurring_update).length,
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-primary" />
              Remanejamentos
            </h1>
            <p className="text-muted-foreground">
              Histórico e gerenciamento de remanejamentos de aulas
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.today}</p>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.recurring}</p>
                  <p className="text-xs text-muted-foreground">Recorrentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.single}</p>
                  <p className="text-xs text-muted-foreground">Únicos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="today">Hoje</TabsTrigger>
                <TabsTrigger value="week">Esta Semana</TabsTrigger>
                <TabsTrigger value="month">Este Mês</TabsTrigger>
                <TabsTrigger value="custom">Período</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {activeTab === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os ambientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os ambientes</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} ({room.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={recurringFilter} onValueChange={setRecurringFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="recurring">Recorrentes</SelectItem>
                      <SelectItem value="single">Únicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Título, solicitante..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Reschedulings Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Histórico de Remanejamentos</CardTitle>
            <CardDescription>
              {filteredReschedulings.length} remanejamento(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredReschedulings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum remanejamento encontrado</p>
                <p className="text-sm">Ajuste os filtros ou selecione outro período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Reserva</TableHead>
                      <TableHead>De</TableHead>
                      <TableHead></TableHead>
                      <TableHead>Para</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReschedulings.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {format(parseISO(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <div className="text-muted-foreground">
                              {format(parseISO(item.created_at), "HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.reservations?.title}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {item.reservations?.requester_name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-destructive" />
                            <div>
                              <div className="font-medium">{item.original_room?.name}</div>
                              <div className="text-xs text-muted-foreground">{item.original_room?.code}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="w-4 h-4 text-primary" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-success" />
                            <div>
                              <div className="font-medium">{item.new_room?.name}</div>
                              <div className="text-xs text-muted-foreground">{item.new_room?.code}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.is_recurring_update ? (
                            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                              Recorrente ({item.affected_reservations_count})
                            </Badge>
                          ) : (
                            <Badge variant="outline">Único</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                            {item.reason || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.rescheduled_by_name || '-'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
