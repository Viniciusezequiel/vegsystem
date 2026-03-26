import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Loader2, Users, MapPin, Search, Check } from 'lucide-react';
import { useFindAvailableRooms, useCreateReservation, useCreateRecurringReservations, type AvailableRoom } from '@/hooks/useRoomReservations';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];
const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function NewReservationForm() {
  const navigate = useNavigate();
  const createReservation = useCreateReservation();
  const createRecurring = useCreateRecurringReservations();

  // Step 1: availability search
  const [step, setStep] = useState<1 | 2>(1);
  const [searchParams, setSearchParams] = useState({
    date: '',
    start_time: '',
    end_time: '',
    attendees_count: 1,
    campus: '' as CampusEnum | '',
  });

  // Step 2: reservation details
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    notes: '',
    repeat: false,
    repeatWeeks: 4,
  });

  const canSearch = searchParams.date && searchParams.start_time && searchParams.end_time;
  const startDt = canSearch ? `${searchParams.date}T${searchParams.start_time}:00` : '';
  const endDt = canSearch ? `${searchParams.date}T${searchParams.end_time}:00` : '';

  const { data: availableRooms, isLoading: searching, refetch } = useFindAvailableRooms({
    startDatetime: startDt,
    endDatetime: endDt,
    attendeesCount: searchParams.attendees_count,
    campus: searchParams.campus || undefined,
    enabled: false,
  });

  const handleSearch = () => {
    if (!canSearch) {
      toast.error('Preencha data, horário de início e término.');
      return;
    }
    if (endDt <= startDt) {
      toast.error('O horário de término deve ser após o início.');
      return;
    }
    refetch();
  };

  const handleSelectRoom = (room: AvailableRoom) => {
    setSelectedRoom(room);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !form.title) {
      toast.error('Preencha o título da reserva.');
      return;
    }

    try {
      if (form.repeat && form.repeatWeeks > 1) {
        await createRecurring.mutateAsync({
          title: form.title,
          description: form.description || undefined,
          room_id: selectedRoom.id,
          date: searchParams.date,
          start_time: searchParams.start_time,
          end_time: searchParams.end_time,
          attendees_count: searchParams.attendees_count,
          notes: form.notes || undefined,
          repeatWeeks: form.repeatWeeks,
        });
      } else {
        await createReservation.mutateAsync({
          title: form.title,
          description: form.description || undefined,
          room_id: selectedRoom.id,
          start_datetime: startDt,
          end_datetime: endDt,
          attendees_count: searchParams.attendees_count,
          notes: form.notes || undefined,
        });
        toast.success('Reserva criada com sucesso!');
      }
      navigate('/reservations');
    } catch {
      // handled by hooks
    }
  };

  const isPending = createReservation.isPending || createRecurring.isPending;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => step === 2 ? setStep(1) : navigate('/reservations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova Reserva</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 ? 'Busque salas disponíveis' : 'Complete os dados da reserva'}
            </p>
          </div>
        </div>

        {step === 1 && (
          <>
            {/* Search Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar Disponibilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={searchParams.date}
                      onChange={e => setSearchParams(p => ({ ...p, date: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label>Início *</Label>
                    <Input
                      type="time"
                      value={searchParams.start_time}
                      onChange={e => setSearchParams(p => ({ ...p, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Término *</Label>
                    <Input
                      type="time"
                      value={searchParams.end_time}
                      onChange={e => setSearchParams(p => ({ ...p, end_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nº de Pessoas *</Label>
                    <Input
                      type="number"
                      min={1}
                      value={searchParams.attendees_count}
                      onChange={e => setSearchParams(p => ({ ...p, attendees_count: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1 max-w-xs">
                    <Label>Campus (opcional)</Label>
                    <Select value={searchParams.campus} onValueChange={v => setSearchParams(p => ({ ...p, campus: v as CampusEnum }))}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Campus</SelectItem>
                        {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSearch} disabled={searching || !canSearch}>
                    {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Buscar Salas
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {availableRooms !== undefined && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {availableRooms.length > 0
                    ? `${availableRooms.length} sala(s) disponível(is)`
                    : 'Nenhuma sala disponível para este horário'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableRooms.map(room => (
                    <Card key={room.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelectRoom(room)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{room.name}</h3>
                            <p className="text-xs text-muted-foreground">{room.code}</p>
                          </div>
                          <Badge variant="outline">{room.campus}</Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Capacidade: {room.capacity}
                          </div>
                          {room.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {room.location}
                            </div>
                          )}
                          {room.description && <p>{room.description}</p>}
                        </div>
                        <Button size="sm" className="mt-3 w-full">
                          <Check className="h-3 w-3 mr-1" /> Selecionar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && selectedRoom && (
          <form onSubmit={handleSubmit}>
            {/* Selected room summary */}
            <Card className="border-primary/50 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1">{selectedRoom.campus}</Badge>
                    <h3 className="font-semibold">{selectedRoom.name} ({selectedRoom.code})</h3>
                    <p className="text-xs text-muted-foreground">
                      {searchParams.date} • {searchParams.start_time} - {searchParams.end_time} • {searchParams.attendees_count} pessoa(s)
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>
                    Trocar Sala
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Dados da Reserva
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Reunião de equipe"
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Detalhes sobre a reserva"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Observações adicionais"
                    rows={2}
                  />
                </div>

                {/* Recurring */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.repeat} onCheckedChange={v => setForm(f => ({ ...f, repeat: v }))} />
                    <div>
                      <Label className="cursor-pointer">Repetir semanalmente</Label>
                      <p className="text-xs text-muted-foreground">
                        {searchParams.date
                          ? `Repete toda ${(() => {
                              const d = new Date(searchParams.date + 'T12:00:00');
                              const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
                              return days[d.getDay()];
                            })()} no mesmo horário`
                          : 'Repete no mesmo dia da semana e horário por várias semanas'}
                      </p>
                    </div>
                  </div>
                  {form.repeat && (
                    <div className="max-w-xs">
                      <Label>Quantidade de semanas</Label>
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={form.repeatWeeks}
                        onChange={e => setForm(f => ({ ...f, repeatWeeks: parseInt(e.target.value) || 2 }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Serão criadas {form.repeatWeeks} reservas (incluindo a primeira)
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/reservations')}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {form.repeat ? `Criar ${form.repeatWeeks} Reservas` : 'Solicitar Reserva'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
