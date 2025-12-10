import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservations, useReservationRooms, Reservation } from '@/hooks/useReservations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Plus, FileDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReservationDetailsDialog } from '@/components/reservations/ReservationDetailsDialog';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Constants } from '@/integrations/supabase/types';

const statusColors = {
  pending: 'bg-warning/80 text-warning-foreground',
  confirmed: 'bg-success/80 text-success-foreground',
  cancelled: 'bg-destructive/50 text-destructive-foreground opacity-50',
  completed: 'bg-muted text-muted-foreground',
};

const statusConfig = {
  pending: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  confirmed: { label: 'Confirmada', className: 'bg-success/20 text-success border-success/30' },
  cancelled: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  completed: { label: 'Concluída', className: 'bg-muted text-muted-foreground border-border' },
};

export default function ReservationsCalendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [pdfDateFilter, setPdfDateFilter] = useState<string>('');
  const [pdfCampusFilter, setPdfCampusFilter] = useState<string>('all');

  const { data: rooms } = useReservationRooms();
  const { data: reservations } = useReservations(
    selectedRoom !== 'all' ? { roomId: selectedRoom } : undefined
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = useMemo(() => {
    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [startDate, endDate]);

  const getReservationsForDay = (day: Date) => {
    return reservations?.filter(res => {
      const resStart = new Date(res.start_datetime);
      const resEnd = new Date(res.end_datetime);
      return isSameDay(day, resStart) || isSameDay(day, resEnd) || 
             (day >= resStart && day <= resEnd);
    }) || [];
  };

  // Filter reservations for PDF export
  const pdfReservations = useMemo(() => {
    if (!reservations) return [];
    let filtered = [...reservations];
    
    if (pdfDateFilter) {
      const filterDate = new Date(pdfDateFilter);
      filtered = filtered.filter(res => {
        const resStart = new Date(res.start_datetime);
        return isSameDay(filterDate, resStart);
      });
    }
    
    if (pdfCampusFilter !== 'all') {
      filtered = filtered.filter(res => res.reservation_rooms?.campus === pdfCampusFilter);
    }
    
    return filtered;
  }, [reservations, pdfDateFilter, pdfCampusFilter]);

  const pdfColumns = [
    { header: 'Ambiente', accessor: 'reservation_rooms.name' },
    { header: 'Título', accessor: 'title' },
    { header: 'Solicitante', accessor: 'requester_name' },
    { header: 'Início', accessor: 'start_datetime' },
    { header: 'Término', accessor: 'end_datetime' },
    { header: 'Participantes', accessor: 'attendees_count' },
    { header: 'Status', accessor: 'status' },
  ];

  const formatDataForPdf = (data: Reservation[]) => {
    return data.map(res => ({
      ...res,
      'reservation_rooms.name': res.reservation_rooms?.name || '',
      start_datetime: format(new Date(res.start_datetime), 'dd/MM/yyyy HH:mm'),
      end_datetime: format(new Date(res.end_datetime), 'dd/MM/yyyy HH:mm'),
      status: statusConfig[res.status]?.label || res.status,
    }));
  };

  return (
    <MainLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Calendário de Reservas</h1>
          </div>
          <p className="page-subtitle">Visualize todas as reservas no calendário</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/reservations')} variant="outline" className="gap-2">
            Lista de Reservas
          </Button>
          <Button onClick={() => navigate('/reservations/new')} className="gap-2 btn-gradient">
            <Plus className="w-4 h-4" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* PDF Export Section */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileDown className="w-4 h-4 text-primary" />
          Exportar Relatório PDF
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Data específica</Label>
            <Input
              type="date"
              value={pdfDateFilter}
              onChange={(e) => setPdfDateFilter(e.target.value)}
              className="w-48 bg-secondary/50"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Campus</Label>
            <Select value={pdfCampusFilter} onValueChange={setPdfCampusFilter}>
              <SelectTrigger className="w-48 bg-secondary/50">
                <SelectValue placeholder="Filtrar por campus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os campus</SelectItem>
                {Constants.public.Enums.campus_enum.map((campus) => (
                  <SelectItem key={campus} value={campus}>
                    {campus}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(pdfDateFilter || pdfCampusFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => { setPdfDateFilter(''); setPdfCampusFilter('all'); }}
            >
              Limpar filtros
            </Button>
          )}
          <PdfExportButton
            data={formatDataForPdf(pdfReservations)}
            columns={pdfColumns}
            title={`Relatório de Reservas${pdfDateFilter ? ` - ${format(new Date(pdfDateFilter), 'dd/MM/yyyy')}` : ''}${pdfCampusFilter !== 'all' ? ` - ${pdfCampusFilter}` : ''}`}
            filename={`reservas${pdfDateFilter ? `-${pdfDateFilter}` : ''}${pdfCampusFilter !== 'all' ? `-${pdfCampusFilter.replace(/\s/g, '_')}` : ''}`}
          />
          <span className="text-sm text-muted-foreground">
            {pdfReservations.length} reserva(s) no relatório
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-bold text-foreground min-w-48 text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            className="h-10 px-3 rounded-md border border-input bg-secondary/50 text-sm"
            onChange={(e) => {
              if (e.target.value) {
                setCurrentMonth(new Date(e.target.value));
              }
            }}
          />
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-64 bg-secondary/50">
              <SelectValue placeholder="Filtrar por ambiente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ambientes</SelectItem>
              {rooms?.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name} ({room.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-secondary/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-muted-foreground border-b border-border/50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayReservations = getReservationsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={cn(
                  'min-h-28 p-2 border-b border-r border-border/30 transition-colors',
                  !isCurrentMonth && 'bg-muted/20',
                  isToday && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  isToday && 'text-primary font-bold'
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayReservations.slice(0, 3).map((res) => (
                    <div
                      key={res.id}
                      className={cn(
                        'text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 hover:ring-1 hover:ring-primary/50',
                        statusColors[res.status]
                      )}
                      onClick={() => setSelectedReservation(res)}
                      title={`${res.title} - ${res.reservation_rooms?.name}`}
                    >
                      {format(new Date(res.start_datetime), 'HH:mm')} {res.title}
                    </div>
                  ))}
                  {dayReservations.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayReservations.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-warning/80" />
          <span className="text-sm text-muted-foreground">Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success/80" />
          <span className="text-sm text-muted-foreground">Confirmada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-destructive/50" />
          <span className="text-sm text-muted-foreground">Cancelada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted" />
          <span className="text-sm text-muted-foreground">Concluída</span>
        </div>
      </div>

      {/* Reservation Details Dialog */}
      <ReservationDetailsDialog
        reservation={selectedReservation}
        open={!!selectedReservation}
        onOpenChange={(open) => !open && setSelectedReservation(null)}
      />
    </MainLayout>
  );
}
