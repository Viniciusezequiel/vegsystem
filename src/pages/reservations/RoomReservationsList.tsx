import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Clock, MapPin, Plus, Users, Check, X, Trash2,
  ChevronDown, ChevronUp, ArrowRightLeft, FileText, Download, ExternalLink, Upload,
  LayoutGrid, CalendarDays,
} from 'lucide-react';
import {
  useRoomReservations, useReservationRooms, useUpdateReservationStatus,
  useDeleteReservation, type RoomReservation,
} from '@/hooks/useRoomReservations';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isToday, isTomorrow, isPast, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RescheduleDialog } from '@/components/reservations/RescheduleDialog';
import { ImportReservationsDialog } from '@/pages/reservations/ImportReservationsDialog';
import { ReservationFiltersBar, type FiltersState } from '@/components/reservations/FiltersBar';
import { ReservationsCalendar } from '@/components/reservations/ReservationsCalendar';
import * as XLSX from 'xlsx';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  confirmed: { label: 'Confirmada', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  completed: { label: 'Concluída', variant: 'outline' },
};

const DEFAULT_FILTERS: FiltersState = {
  search: '', startDate: '', endDate: '', status: 'all', campus: 'all', roomId: 'all',
};

export default function RoomReservationsList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rescheduleReservation, setRescheduleReservation] = useState<RoomReservation | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: rooms } = useReservationRooms();
  const { data: reservations, isLoading } = useRoomReservations({
    status: filters.status,
    campus: filters.campus !== 'all' ? filters.campus : undefined,
    roomId: filters.roomId !== 'all' ? filters.roomId : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    search: filters.search || undefined,
  });

  const updateStatus = useUpdateReservationStatus();
  const deleteReservation = useDeleteReservation();

  const formatDateTime = (dt: string) =>
    format(parseISO(dt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

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

  const applyReportFilter = (type: 'today' | 'week' | 'month') => {
    const now = new Date();
    if (type === 'today') {
      const todayStr = format(now, 'yyyy-MM-dd');
      setFilters(f => ({ ...f, startDate: todayStr, endDate: todayStr, status: 'all' }));
    } else if (type === 'week') {
      setFilters(f => ({
        ...f,
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        status: 'all',
      }));
    } else {
      setFilters(f => ({
        ...f,
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        status: 'all',
      }));
    }
  };

  const handleExport = () => {
    if (!reservations?.length) {
      toast.error('Nenhuma reserva para exportar.');
      return;
    }
    const rows = reservations.map(r => ({
      'Título': r.title,
      'Sala': r.room?.name || 'N/A',
      'Código': r.room?.code || '',
      'Campus': r.room?.campus || '',
      'Início': format(parseISO(r.start_datetime), 'dd/MM/yyyy HH:mm'),
      'Término': format(parseISO(r.end_datetime), 'dd/MM/yyyy HH:mm'),
      'Participantes': r.attendees_count,
      'Solicitante': r.requester_name,
      'E-mail': r.requester_email || '',
      'Status': statusConfig[r.status]?.label || r.status,
      'Descrição': r.description || '',
      'Observações': r.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reservas');
    XLSX.writeFile(wb, `reservas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const renderReservationCard = (reservation: RoomReservation) => {
    const isExpanded = expandedId === reservation.id;
    const status = statusConfig[reservation.status] || { label: reservation.status, variant: 'outline' as const };
    const dateLabel = getDateLabel(reservation.start_datetime);
    const isOverdue = reservation.status === 'confirmed' && isPast(parseISO(reservation.end_datetime));

    return (
      <Card key={reservation.id} className={`transition-all ${isOverdue ? 'border-destructive/50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{reservation.title}</h3>
                <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                {dateLabel && <Badge variant="outline" className="text-[10px] text-primary">{dateLabel}</Badge>}
                {isOverdue && <Badge variant="destructive" className="text-[10px]">Expirada</Badge>}
                {reservation.is_fixed && <Badge variant="outline" className="text-[10px]">Fixa</Badge>}
                {reservation.is_external && <Badge variant="outline" className="text-[10px]">Externa</Badge>}
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
                  <Users className="h-3 w-3" /> {reservation.attendees_count}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(reservation.status === 'pending' || reservation.status === 'confirmed') && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  title="Remanejar"
                  onClick={() => setRescheduleReservation(reservation)}
                >
                  <ArrowRightLeft className="h-3 w-3" />
                </Button>
              )}

              {reservation.status === 'pending' && isAdmin && (
                <>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-primary"
                    onClick={() => updateStatus.mutate({ id: reservation.id, status: 'confirmed' })}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => updateStatus.mutate({ id: reservation.id, status: 'cancelled' })}>
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
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteReservation.mutate(reservation.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => setExpandedId(isExpanded ? null : reservation.id)}>
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-2 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Solicitante:</span> <span className="font-medium">{reservation.requester_name}</span></div>
                {reservation.requester_email && <div><span className="text-muted-foreground">E-mail:</span> {reservation.requester_email}</div>}
                {reservation.requester_phone && <div><span className="text-muted-foreground">Telefone:</span> {reservation.requester_phone}</div>}
                <div><span className="text-muted-foreground">Campus:</span> {reservation.room?.campus || 'N/A'}</div>
                <div><span className="text-muted-foreground">Início:</span> {formatDateTime(reservation.start_datetime)}</div>
                <div><span className="text-muted-foreground">Término:</span> {formatDateTime(reservation.end_datetime)}</div>
              </div>
              {reservation.description && <div><span className="text-muted-foreground">Descrição:</span> {reservation.description}</div>}
              {reservation.notes && <div><span className="text-muted-foreground">Observações:</span> {reservation.notes}</div>}
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
            <h1 className="text-2xl font-bold">Gestão de Salas</h1>
            <p className="text-sm text-muted-foreground">Gerencie as reservas de salas e espaços</p>
          </div>
          <div className="flex gap-2 flex-wrap">
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

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => applyReportFilter('today')}>
            <FileText className="h-3 w-3 mr-1" /> Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyReportFilter('week')}>
            <FileText className="h-3 w-3 mr-1" /> Esta Semana
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyReportFilter('month')}>
            <FileText className="h-3 w-3 mr-1" /> Este Mês
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!reservations?.length}>
            <Download className="h-3 w-3 mr-1" /> Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const link = `${window.location.origin}/painel-reservas`;
            navigator.clipboard.writeText(link);
            toast.success('Link do painel público copiado!');
          }}>
            <ExternalLink className="h-3 w-3 mr-1" /> Copiar Link Público
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/painel-reservas', '_blank')}>
            <ExternalLink className="h-3 w-3 mr-1" /> Abrir Painel
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3 w-3 mr-1" /> Importar Mapa
            </Button>
          )}
        </div>

        {/* Filters bar */}
        <ReservationFiltersBar value={filters} onChange={setFilters} rooms={rooms || []} />

        {/* View toggle + tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={filters.status} onValueChange={v => setFilters(f => ({ ...f, status: v }))}>
            <TabsList>
              <TabsTrigger value="all">Todas ({counts.all})</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmadas ({counts.confirmed})</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas ({counts.cancelled})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('list')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Lista
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Calendário
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !reservations?.length ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma reserva encontrada</div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {reservations.map(renderReservationCard)}
          </div>
        ) : (
          <ReservationsCalendar
            reservations={reservations}
            onSelect={r => setExpandedId(r.id)}
          />
        )}
      </div>

      {rescheduleReservation && (
        <RescheduleDialog
          reservation={rescheduleReservation}
          open={!!rescheduleReservation}
          onOpenChange={open => { if (!open) setRescheduleReservation(null); }}
        />
      )}

      <ImportReservationsDialog open={importOpen} onOpenChange={setImportOpen} />
    </MainLayout>
  );
}
