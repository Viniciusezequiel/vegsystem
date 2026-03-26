import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, addDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock, Users, Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

type Room = { id: string; name: string; code: string; campus: string; capacity: number };
type Reservation = {
  id: string; title: string; requester_name: string;
  start_datetime: string; end_datetime: string;
  status: string; attendees_count: number; room_id: string;
};

export default function PublicReservationBoard() {
  const [campus, setCampus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    const [roomsRes, reservationsRes] = await Promise.all([
      supabase.from('reservation_rooms').select('id, name, code, campus, capacity').eq('is_active', true).order('code'),
      supabase.from('reservations').select('id, title, requester_name, start_datetime, end_datetime, status, attendees_count, room_id')
        .gte('start_datetime', dayStart).lte('start_datetime', dayEnd)
        .in('status', ['pending', 'confirmed']),
    ]);

    if (roomsRes.data) setRooms(roomsRes.data);
    if (reservationsRes.data) setReservations(reservationsRes.data);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('public-board-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const filteredRooms = useMemo(() => {
    if (campus === 'all') return rooms;
    return rooms.filter(r => r.campus === campus);
  }, [rooms, campus]);

  const getReservationsForRoom = (roomId: string) =>
    reservations.filter(r => r.room_id === roomId);

  const getSlotStatus = (roomId: string, slotHour: string) => {
    const slotStart = new Date(selectedDate);
    const [h] = slotHour.split(':').map(Number);
    slotStart.setHours(h, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(h + 1, 0, 0, 0);

    return reservations.find(r => {
      if (r.room_id !== roomId) return false;
      const rStart = new Date(r.start_datetime);
      const rEnd = new Date(r.end_datetime);
      return rStart < slotEnd && rEnd > slotStart;
    });
  };

  const navigateDay = (offset: number) => {
    setSelectedDate(prev => addDays(prev, offset));
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Painel de Reservas de Salas
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Atualizado em {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={campus} onValueChange={setCampus}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="Todas unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas unidades</SelectItem>
                  {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button onClick={() => navigateDay(-1)} className="p-1.5 rounded hover:bg-background transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${isToday ? 'bg-primary text-primary-foreground' : 'hover:bg-background'}`}
                >
                  Hoje
                </button>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={e => e.target.value && setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
                  className="px-2 py-1.5 rounded text-sm bg-transparent border-0 focus:outline-none"
                />
                <button onClick={() => navigateDay(1)} className="p-1.5 rounded hover:bg-background transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button onClick={fetchData} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Atualizar">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4">
        {/* Date label */}
        <div className="mb-4 text-center">
          <h2 className="text-lg font-semibold capitalize">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma sala encontrada para o filtro selecionado.
          </div>
        ) : (
          <>
            {/* Grid View */}
            <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted/80 backdrop-blur-sm px-3 py-2 text-left text-xs font-semibold text-foreground border-r min-w-[160px]">
                      Sala
                    </th>
                    {TIME_SLOTS.map(slot => (
                      <th key={slot} className="px-1 py-2 text-center text-[11px] font-medium text-muted-foreground min-w-[70px] border-r last:border-r-0">
                        {slot}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map(room => (
                    <tr key={room.id} className="border-t hover:bg-muted/20 transition-colors">
                      <td className="sticky left-0 z-10 bg-card backdrop-blur-sm px-3 py-2 border-r">
                        <div className="text-sm font-medium text-foreground">{room.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" /> {room.campus}
                          <span className="ml-1">• {room.capacity} lug.</span>
                        </div>
                      </td>
                      {TIME_SLOTS.map(slot => {
                        const reservation = getSlotStatus(room.id, slot);
                        return (
                          <td key={slot} className="px-0.5 py-1 border-r last:border-r-0">
                            {reservation ? (
                              <div
                                className={`rounded px-1.5 py-1 text-[10px] leading-tight cursor-default ${
                                  reservation.status === 'confirmed'
                                    ? 'bg-primary/15 text-primary border border-primary/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                }`}
                                title={`${reservation.title} — ${reservation.requester_name}\n${format(parseISO(reservation.start_datetime), 'HH:mm')} - ${format(parseISO(reservation.end_datetime), 'HH:mm')}`}
                              >
                                <div className="font-medium truncate">{reservation.title}</div>
                                <div className="truncate opacity-75">{reservation.requester_name}</div>
                              </div>
                            ) : (
                              <div className="h-8 rounded bg-muted/30" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* List View below for details */}
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Reservas do dia ({reservations.filter(r => campus === 'all' || filteredRooms.some(fr => fr.id === r.room_id)).length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRooms.map(room => {
                  const roomReservations = getReservationsForRoom(room.id);
                  if (roomReservations.length === 0) return null;
                  return roomReservations.map(r => (
                    <div key={r.id} className="rounded-lg border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.requester_name}</p>
                        </div>
                        <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {r.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {room.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(r.start_datetime), 'HH:mm')} - {format(parseISO(r.end_datetime), 'HH:mm')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {r.attendees_count}
                        </span>
                      </div>
                    </div>
                  ));
                })}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-muted-foreground py-4 border-t">
          Painel de Reservas • Atualização automática a cada 60 segundos
        </footer>
      </main>
    </div>
  );
}
