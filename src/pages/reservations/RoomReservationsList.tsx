import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, Plus, Search, Users, Check, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useRoomReservations, useReservationRooms, useUpdateReservationStatus, useDeleteReservation, type RoomReservation } from '@/hooks/useRoomReservations';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePickerInput } from '@/components/ui/DatePickerInput';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  completed: { label: 'Concluída', variant: 'outline' },
};

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function RoomReservationsList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campusFilter, setCampusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rooms } = useReservationRooms();
  const { data: reservations, isLoading } = useRoomReservations({
    status: statusFilter,
    campus: campusFilter !== 'all' ? campusFilter : undefined,
    roomId: roomFilter !== 'all' ? roomFilter : undefined,
    startDate: startDate ? startDate.toISOString() : undefined,
    endDate: endDate ? endDate.toISOString() : undefined,
    search: search || undefined,
  });

  const updateStatus = useUpdateReservationStatus();
  const deleteReservation = useDeleteReservation();

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (campusFilter !== 'all') return rooms.filter(r => r.campus === campusFilter);
    return rooms;
  }, [rooms, campusFilter]);

  const formatDateTime = (dt: string) => {
    const d = parseISO(dt);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getDateLabel = (dt: string) => {
    const d = parseISO(dt);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return null;
  };

  const counts = useMemo(() => {
    if (!reservations) return { pending: 0, confirmed: 0, cancelled: 0, all: 0 };
    return {
      pending: reservations.filter(r => r.status === 'pending').length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      all: reservations.length,
    };
  }, [reservations]);

  const renderReservationCard = (reservation: RoomReservation) => {
    const isExpanded = expandedId === reservation.id;
    const status = statusConfig[reservation.status] || { label: reservation.status, variant: 'outline' as const };
    const dateLabel = getDateLabel(reservation.start_datetime);
    const isOverdue = reservation.status === 'confirmed' && isPast(parseISO(reservation.end_datetime));

    return (
      <Card key={reservation.id} className={`transition-all ${isOverdue ? 'border-destructive/50' : ''}`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{reservation.title}</h3>
                <Badge variant={status.variant} className="text-[10px]">
                  {status.label}
                </Badge>
                {dateLabel && (
                  <Badge variant="outline" className="text-[10px] text-primary">
                    {dateLabel}
                  </Badge>
                )}
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px]">Expirada</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {reservation.room?.name || 'N/A'} ({reservation.room?.code})
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(parseISO(reservation.start_datetime), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(parseISO(reservation.start_datetime), 'HH:mm')} - {format(parseISO(reservation.end_datetime), 'HH:mm')}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {reservation.attendees_count}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {reservation.status === 'pending' && isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-green-600"
                    onClick={() => updateStatus.mutate({ id: reservation.id, status: 'confirmed' })}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => updateStatus.mutate({ id: reservation.id, status: 'cancelled' })}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir reserva?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteReservation.mutate(reservation.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpandedId(isExpanded ? null : reservation.id)}
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-2 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Solicitante:</span>{' '}
                  <span className="font-medium">{reservation.requester_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">E-mail:</span>{' '}
                  <span>{reservation.requester_email}</span>
                </div>
                {reservation.requester_phone && (
                  <div>
                    <span className="text-muted-foreground">Telefone:</span>{' '}
                    <span>{reservation.requester_phone}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Campus:</span>{' '}
                  <span>{reservation.room?.campus || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Início:</span>{' '}
                  <span>{formatDateTime(reservation.start_datetime)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Término:</span>{' '}
                  <span>{formatDateTime(reservation.end_datetime)}</span>
                </div>
              </div>
              {reservation.description && (
                <div>
                  <span className="text-muted-foreground">Descrição:</span>{' '}
                  <span>{reservation.description}</span>
                </div>
              )}
              {reservation.notes && (
                <div>
                  <span className="text-muted-foreground">Observações:</span>{' '}
                  <span>{reservation.notes}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Reservas de Salas</h1>
            <p className="text-sm text-muted-foreground">Gerencie as reservas de salas e espaços</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate('/reservations/rooms')}>
                <MapPin className="h-4 w-4 mr-2" />
                Gestão de Salas
              </Button>
            )}
            <Button onClick={() => navigate('/reservations/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Reserva
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={campusFilter} onValueChange={v => { setCampusFilter(v); setRoomFilter('all'); }}>
            <SelectTrigger><SelectValue placeholder="Campus" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Campus</SelectItem>
              {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={roomFilter} onValueChange={setRoomFilter}>
            <SelectTrigger><SelectValue placeholder="Sala" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Salas</SelectItem>
              {filteredRooms.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerInput
            value={startDate}
            onChange={setStartDate}
            placeholder="Data início"
          />
          <DatePickerInput
            value={endDate}
            onChange={setEndDate}
            placeholder="Data fim"
          />
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">Todas ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmadas ({counts.confirmed})</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas ({counts.cancelled})</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !reservations?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma reserva encontrada
              </div>
            ) : (
              <div className="space-y-3">
                {reservations.map(renderReservationCard)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
