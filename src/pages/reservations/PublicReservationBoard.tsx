import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO, addDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock, Users, Calendar, ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];
const TIME_SLOTS = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);

type Room = { id: string; name: string; code: string; campus: string; capacity: number };
type Reservation = {
  id: string; title: string; requester_name: string;
  start_datetime: string; end_datetime: string;
  status: string; attendees_count: number; room_id: string;
  description: string | null; notes: string | null;
  requester_email: string; requester_phone: string | null;
};

export default function PublicReservationBoard() {
  const [campus, setCampus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<(Reservation & { room?: Room }) | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    const [roomsRes, reservationsRes] = await Promise.all([
      supabase.from('reservation_rooms').select('id, name, code, campus, capacity').eq('is_active', true).order('code'),
      supabase.from('reservations').select('id, title, requester_name, start_datetime, end_datetime, status, attendees_count, room_id, description, notes, requester_email, requester_phone')
        .gte('start_datetime', dayStart).lte('start_datetime', dayEnd)
        .in('status', ['pending', 'confirmed']),
    ]);

    if (roomsRes.data) setRooms(roomsRes.data);
    if (reservationsRes.data) setReservations(reservationsRes.data as Reservation[]);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  useEffect(() => {
    const channel = supabase
      .channel('public-board-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  const filteredRooms = useMemo(() => {
    if (campus === 'all') return rooms;
    return rooms.filter(r => r.campus === campus);
  }, [rooms, campus]);

  // Filter reservations by search
  const filteredReservations = useMemo(() => {
    if (!search.trim()) return reservations;
    const q = search.toLowerCase();
    return reservations.filter(r => {
      const room = rooms.find(rm => rm.id === r.room_id);
      return (
        r.title.toLowerCase().includes(q) ||
        r.requester_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (room && room.name.toLowerCase().includes(q)) ||
        (room && room.code.toLowerCase().includes(q)) ||
        (room && room.campus.toLowerCase().includes(q))
      );
    });
  }, [reservations, search, rooms]);

  const getReservationsForRoom = (roomId: string) =>
    filteredReservations.filter(r => r.room_id === roomId);

  const getSlotStatus = (roomId: string, slotHour: string) => {
    const slotStart = new Date(selectedDate);
    const [h] = slotHour.split(':').map(Number);
    slotStart.setHours(h, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(h + 1, 0, 0, 0);

    return filteredReservations.find(r => {
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

  const handleReservationClick = (reservation: Reservation) => {
    const room = rooms.find(r => r.id === reservation.room_id);
    setSelectedReservation({ ...reservation, room });
  };

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
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar reserva..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-8 h-9 w-[220px] text-sm"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>

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
          {search && (
            <p className="text-sm text-muted-foreground mt-1">
              Resultados para "{search}": {filteredReservations.length} reserva(s)
            </p>
          )}
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
                                className={`rounded px-1.5 py-1 text-[10px] leading-tight cursor-pointer hover:opacity-80 transition-opacity ${
                                  reservation.status === 'confirmed'
                                    ? 'bg-primary/15 text-primary border border-primary/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                }`}
                                onClick={() => handleReservationClick(reservation)}
                                title="Clique para ver detalhes"
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
                Reservas do dia ({filteredReservations.filter(r => campus === 'all' || filteredRooms.some(fr => fr.id === r.room_id)).length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredRooms.map(room => {
                  const roomReservations = getReservationsForRoom(room.id);
                  if (roomReservations.length === 0) return null;
                  return roomReservations.map(r => (
                    <div
                      key={r.id}
                      className="rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                      onClick={() => handleReservationClick(r)}
                    >
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

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={open => { if (!open) setSelectedReservation(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Detalhes da Reserva
            </DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{selectedReservation.title}</h3>
                <Badge
                  variant={selectedReservation.status === 'confirmed' ? 'default' : 'secondary'}
                  className="mt-1"
                >
                  {selectedReservation.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{selectedReservation.room?.name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedReservation.room?.code} • {selectedReservation.room?.campus}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {format(parseISO(selectedReservation.start_datetime), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(selectedReservation.start_datetime), 'HH:mm')} às {format(parseISO(selectedReservation.end_datetime), 'HH:mm')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{selectedReservation.requester_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedReservation.attendees_count} participante(s)</p>
                  </div>
                </div>

                {selectedReservation.description && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm">{selectedReservation.description}</p>
                  </div>
                )}

                {selectedReservation.notes && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm">{selectedReservation.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
