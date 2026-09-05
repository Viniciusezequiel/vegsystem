import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, endOfDay, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];
const TIME_SLOTS = Array.from({ length: 15 }, (_, index) => `${String(7 + index).padStart(2, '0')}:00`);

type Room = {
  id: string;
  name: string;
  code: string;
  campus: string;
  capacity: number;
};

type Reservation = {
  id: string;
  title: string;
  start_datetime: string;
  end_datetime: string;
  status: string;
  attendees_count: number;
  room_id: string;
  description: string | null;
  notes: string | null;
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    try {
      const [roomsRes, reservationsRes] = await Promise.all([
        supabase
          .from('reservation_rooms')
          .select('id, name, code, campus, capacity')
          .eq('is_active', true)
          .order('code'),
        supabase.rpc('get_public_reservations', { p_start: dayStart, p_end: dayEnd }),
      ]);

      if (roomsRes.data) setRooms(roomsRes.data);
      if (reservationsRes.data) setReservations(reservationsRes.data as Reservation[]);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel('public-board-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        void fetchData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => void fetchData(), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredRooms = useMemo(() => {
    if (campus === 'all') return rooms;
    return rooms.filter(room => room.campus === campus);
  }, [campus, rooms]);

  const filteredReservations = useMemo(() => {
    if (!search.trim()) return reservations;
    const term = search.toLowerCase();

    return reservations.filter(reservation => {
      const room = rooms.find(candidate => candidate.id === reservation.room_id);
      return (
        reservation.title.toLowerCase().includes(term) ||
        reservation.description?.toLowerCase().includes(term) ||
        reservation.notes?.toLowerCase().includes(term) ||
        room?.name.toLowerCase().includes(term) ||
        room?.code.toLowerCase().includes(term) ||
        room?.campus.toLowerCase().includes(term)
      );
    });
  }, [reservations, rooms, search]);

  const visibleReservations = useMemo(
    () => filteredReservations.filter(reservation => filteredRooms.some(room => room.id === reservation.room_id)),
    [filteredReservations, filteredRooms]
  );

  const totalAttendees = useMemo(
    () => visibleReservations.reduce((sum, reservation) => sum + (reservation.attendees_count || 0), 0),
    [visibleReservations]
  );

  const roomsInUse = useMemo(
    () => new Set(visibleReservations.map(reservation => reservation.room_id)).size,
    [visibleReservations]
  );

  const getReservationsForRoom = (roomId: string) =>
    filteredReservations.filter(reservation => reservation.room_id === roomId);

  const getSlotStatus = (roomId: string, slotHour: string) => {
    const slotStart = new Date(selectedDate);
    const [hour] = slotHour.split(':').map(Number);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return filteredReservations.find(reservation => {
      if (reservation.room_id !== roomId) return false;
      const reservationStart = new Date(reservation.start_datetime);
      const reservationEnd = new Date(reservation.end_datetime);
      return reservationStart < slotEnd && reservationEnd > slotStart;
    });
  };

  const navigateDay = (offset: number) => {
    setSelectedDate(previous => addDays(previous, offset));
  };

  const handleReservationClick = (reservation: Reservation) => {
    const room = rooms.find(candidate => candidate.id === reservation.room_id);
    setSelectedReservation({ ...reservation, room });
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[1720px] px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">Painel de Reservas de Salas</h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Atualização automática · última leitura às {format(lastUpdate, 'HH:mm:ss', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 sm:w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar reserva ou sala..."
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="h-9 pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select value={campus} onValueChange={setCampus}>
                <SelectTrigger className="h-9 sm:w-[190px]">
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {campusOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="flex items-center rounded-lg border border-border/60 bg-card/65 p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay(-1)} aria-label="Dia anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={isToday ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setSelectedDate(new Date())}
                >
                  Hoje
                </Button>
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={event => event.target.value && setSelectedDate(new Date(`${event.target.value}T12:00:00`))}
                  className="h-7 max-w-[142px] bg-transparent px-2 text-xs outline-none"
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay(1)} aria-label="Próximo dia">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => void fetchData()} title="Atualizar">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-xl font-semibold capitalize tracking-tight sm:text-2xl">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {search ? `${visibleReservations.length} resultado(s) para “${search}”` : 'Visão pública da ocupação e das reservas confirmadas ou pendentes.'}
          </p>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Reservas no dia</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{visibleReservations.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Salas com reserva</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{roomsInUse}<span className="ml-1 text-sm font-normal text-muted-foreground">/ {filteredRooms.length}</span></p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Participantes previstos</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{totalAttendees}</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Atualizando painel...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 px-6 text-center">
            <MapPin className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Nenhuma sala encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Altere o filtro de unidade para visualizar outras salas.</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/65 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/35">
                      <th className="sticky left-0 z-20 min-w-[190px] border-r border-border/60 bg-muted/80 px-4 py-3 text-left text-xs font-semibold backdrop-blur">
                        Sala
                      </th>
                      {TIME_SLOTS.map(slot => (
                        <th key={slot} className="min-w-[76px] border-r border-border/40 px-1 py-3 text-center text-[11px] font-medium text-muted-foreground last:border-r-0">
                          {slot}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map(room => (
                      <tr key={room.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/15">
                        <td className="sticky left-0 z-10 border-r border-border/60 bg-card/95 px-4 py-3 backdrop-blur">
                          <p className="truncate text-sm font-semibold">{room.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>{room.code}</span>
                            <span>·</span>
                            <span>{room.campus}</span>
                            <span>·</span>
                            <span>{room.capacity} lugares</span>
                          </div>
                        </td>

                        {TIME_SLOTS.map(slot => {
                          const reservation = getSlotStatus(room.id, slot);
                          return (
                            <td key={slot} className="border-r border-border/30 px-1 py-1.5 last:border-r-0">
                              {reservation ? (
                                <button
                                  type="button"
                                  onClick={() => handleReservationClick(reservation)}
                                  className={`min-h-9 w-full rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight transition-all hover:-translate-y-px hover:shadow-sm ${
                                    reservation.status === 'confirmed'
                                      ? 'border-primary/25 bg-primary/10 text-primary'
                                      : 'border-warning/30 bg-warning/10 text-foreground'
                                  }`}
                                  title="Ver detalhes da reserva"
                                >
                                  <span className="block truncate font-medium">{reservation.title}</span>
                                </button>
                              ) : (
                                <div className="min-h-9 rounded-md bg-muted/20" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="h-4 w-4 text-primary" />
                    Reservas do dia
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Lista rápida para consulta em telas menores.</p>
                </div>
                <Badge variant="secondary">{visibleReservations.length}</Badge>
              </div>

              {visibleReservations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-5 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma reserva encontrada para os filtros atuais.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRooms.flatMap(room =>
                    getReservationsForRoom(room.id).map(reservation => (
                      <Card
                        key={reservation.id}
                        className="group cursor-pointer border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md"
                        onClick={() => handleReservationClick(reservation)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{reservation.title}</p>
                            <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                              {reservation.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{room.name}</span>
                            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{format(parseISO(reservation.start_datetime), 'HH:mm')} – {format(parseISO(reservation.end_datetime), 'HH:mm')}</span>
                            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{reservation.attendees_count}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="mt-8 border-t border-border/50 py-5 text-center text-xs text-muted-foreground">
          Painel público de reservas · atualização automática a cada 60 segundos
        </footer>
      </main>

      <Dialog open={!!selectedReservation} onOpenChange={open => { if (!open) setSelectedReservation(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Detalhes da reserva
            </DialogTitle>
            <DialogDescription>Informações públicas da ocupação selecionada.</DialogDescription>
          </DialogHeader>

          {selectedReservation && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{selectedReservation.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedReservation.room?.code} · {selectedReservation.room?.campus}</p>
                  </div>
                  <Badge variant={selectedReservation.status === 'confirmed' ? 'default' : 'secondary'}>
                    {selectedReservation.status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Sala</p>
                  <p className="mt-0.5 text-sm font-medium">{selectedReservation.room?.name || 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Horário</p>
                  <p className="mt-0.5 text-sm font-medium">{format(parseISO(selectedReservation.start_datetime), 'HH:mm')} – {format(parseISO(selectedReservation.end_datetime), 'HH:mm')}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Participantes</p>
                  <p className="mt-0.5 text-sm font-medium">{selectedReservation.attendees_count}</p>
                </div>
              </div>

              {(selectedReservation.description || selectedReservation.notes) && (
                <div className="space-y-3 border-t border-border/60 pt-4">
                  {selectedReservation.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Descrição</p>
                      <p className="mt-1 text-sm leading-relaxed">{selectedReservation.description}</p>
                    </div>
                  )}
                  {selectedReservation.notes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Observações</p>
                      <p className="mt-1 text-sm leading-relaxed">{selectedReservation.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
