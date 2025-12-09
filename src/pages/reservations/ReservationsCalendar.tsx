import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservations, useReservationRooms, Reservation } from '@/hooks/useReservations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReservationDetailsDialog } from '@/components/reservations/ReservationDetailsDialog';

const statusColors = {
  pending: 'bg-warning/80 text-warning-foreground',
  confirmed: 'bg-success/80 text-success-foreground',
  cancelled: 'bg-destructive/50 text-destructive-foreground opacity-50',
  completed: 'bg-muted text-muted-foreground',
};

export default function ReservationsCalendar() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

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
