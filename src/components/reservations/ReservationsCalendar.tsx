import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RoomReservation } from '@/hooks/useRoomReservations';

interface Props {
  reservations: RoomReservation[];
  onSelect?: (reservation: RoomReservation) => void;
}

type View = 'month' | 'week';

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
  confirmed: 'bg-primary/15 text-primary border-primary/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
  completed: 'bg-muted text-muted-foreground border-muted',
};

export function ReservationsCalendar({ reservations, onSelect }: Props) {
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());

  const days = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [cursor, view]);

  const byDay = useMemo(() => {
    const map = new Map<string, RoomReservation[]>();
    for (const r of reservations) {
      const key = format(parseISO(r.start_datetime), 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
    }
    return map;
  }, [reservations]);

  const goPrev = () => setCursor(view === 'month' ? subMonths(cursor, 1) : subWeeks(cursor, 1));
  const goNext = () => setCursor(view === 'month' ? addMonths(cursor, 1) : addWeeks(cursor, 1));
  const today = () => setCursor(new Date());

  const headerLabel = view === 'month'
    ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : `Semana de ${format(startOfWeek(cursor, { weekStartsOn: 0 }), 'dd/MM', { locale: ptBR })}`;

  const weekDayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={today}>Hoje</Button>
          <Button variant="outline" size="icon" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
          <span className="ml-3 text-sm font-medium capitalize">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setView('month')}>Mês</Button>
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>Semana</Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
        {weekDayLabels.map(d => (
          <div key={d} className="bg-muted text-muted-foreground text-xs font-medium px-2 py-1 text-center">{d}</div>
        ))}
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const items = byDay.get(key) || [];
          const dimmed = view === 'month' && !isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`bg-background min-h-[110px] p-1.5 text-xs flex flex-col gap-1 ${dimmed ? 'opacity-40' : ''}`}
            >
              <div className={`text-right text-[11px] ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {items.slice(0, 3).map(r => (
                  <button
                    key={r.id}
                    onClick={() => onSelect?.(r)}
                    className={`text-left rounded px-1 py-0.5 border truncate hover:opacity-80 transition-opacity ${statusColor[r.status] || statusColor.pending}`}
                    title={`${r.title} • ${r.room?.code || ''} • ${format(parseISO(r.start_datetime), 'HH:mm')}`}
                  >
                    <span className="font-medium">{format(parseISO(r.start_datetime), 'HH:mm')}</span>{' '}
                    <span className="truncate">{r.title}</span>
                  </button>
                ))}
                {items.length > 3 && (
                  <Badge variant="outline" className="text-[9px] justify-center">+{items.length - 3}</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded border bg-primary/15 border-primary/30" /> Confirmada
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded border bg-yellow-500/15 border-yellow-500/30" /> Pendente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded border bg-destructive/15 border-destructive/30" /> Cancelada
        </span>
      </div>
    </div>
  );
}
