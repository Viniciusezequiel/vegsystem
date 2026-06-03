import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Users, MapPin, Check, ArrowLeft, Calendar, Package } from 'lucide-react';
import { useFindAvailableRooms, type AvailableRoom } from '@/hooks/useRoomReservations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import type { PortalOutletContext } from './PortalLayout';

type CampusEnum = Database['public']['Enums']['campus_enum'];
const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

interface RoomDetails {
  observations?: string | null;
  equipment?: string[] | null;
}

export default function PortalNewReservation() {
  const navigate = useNavigate();
  const { externalUser } = useOutletContext<PortalOutletContext>();

  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState({
    date: '',
    start_time: '',
    end_time: '',
    attendees_count: 1,
    campus: '' as CampusEnum | '',
  });
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [selectedRoomDetails, setSelectedRoomDetails] = useState<RoomDetails | null>(null);
  const [form, setForm] = useState({ title: '', description: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const canSearch = search.date && search.start_time && search.end_time;
  const startDt = canSearch ? `${search.date}T${search.start_time}:00` : '';
  const endDt = canSearch ? `${search.date}T${search.end_time}:00` : '';

  const { data: availableRooms, isLoading, refetch } = useFindAvailableRooms({
    startDatetime: startDt,
    endDatetime: endDt,
    attendeesCount: search.attendees_count,
    campus: search.campus || undefined,
    enabled: false,
  });

  const handleSearch = () => {
    if (!canSearch) return toast.error('Preencha data e horários.');
    if (endDt <= startDt) return toast.error('Término deve ser após o início.');
    refetch();
  };

  const handleSelect = async (room: AvailableRoom) => {
    setSelectedRoom(room);
    // Fetch room extras
    const { data } = await supabase
      .from('reservation_rooms')
      .select('observations, equipment')
      .eq('id', room.id)
      .maybeSingle();
    setSelectedRoomDetails((data as unknown as RoomDetails) || null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !form.title) return toast.error('Preencha o título.');

    setSubmitting(true);
    try {
      const { data: hasConflict } = await supabase.rpc('check_reservation_conflict', {
        p_room_id: selectedRoom.id,
        p_start_datetime: startDt,
        p_end_datetime: endDt,
        p_is_external: true,
      });
      if (hasConflict) throw new Error('Esta sala não está mais disponível neste horário.');

      const { error } = await supabase.from('reservations').insert({
        title: form.title,
        description: form.description || null,
        room_id: selectedRoom.id,
        start_datetime: startDt,
        end_datetime: endDt,
        attendees_count: search.attendees_count,
        notes: form.notes || null,
        requester_name: externalUser.full_name,
        requester_email: externalUser.email,
        status: 'pending',
        is_external: true,
        external_user_id: externalUser.id,
      });

      if (error) throw error;
      toast.success('Reserva solicitada! Aguarde a aprovação.');
      navigate('/portal-cliente/minhas-reservas');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar reserva';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step === 2 ? setStep(1) : navigate('/portal-cliente/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nova Reserva</h1>
          <p className="text-sm text-muted-foreground">
            {step === 1 ? 'Encontre uma sala disponível' : 'Confirme os dados'}
          </p>
        </div>
      </div>

      {step === 1 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" /> Buscar disponibilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label>Data *</Label>
                  <Input type="date" min={new Date().toISOString().split('T')[0]}
                    value={search.date}
                    onChange={e => setSearch(s => ({ ...s, date: e.target.value }))} />
                </div>
                <div>
                  <Label>Início *</Label>
                  <Input type="time" value={search.start_time}
                    onChange={e => setSearch(s => ({ ...s, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label>Término *</Label>
                  <Input type="time" value={search.end_time}
                    onChange={e => setSearch(s => ({ ...s, end_time: e.target.value }))} />
                </div>
                <div>
                  <Label>Pessoas *</Label>
                  <Input type="number" min={1} value={search.attendees_count}
                    onChange={e => setSearch(s => ({ ...s, attendees_count: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <Label>Campus (opcional)</Label>
                  <Select value={search.campus} onValueChange={v => setSearch(s => ({ ...s, campus: v as CampusEnum }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSearch} disabled={isLoading || !canSearch}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {availableRooms !== undefined && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                {availableRooms.length > 0
                  ? `${availableRooms.length} sala(s) disponível(is)`
                  : 'Nenhuma sala disponível para este horário'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableRooms.map(room => (
                  <Card key={room.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelect(room)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{room.name}</h3>
                          <p className="text-xs text-muted-foreground">{room.code}</p>
                        </div>
                        <Badge variant="outline">{room.campus}</Badge>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Capacidade: {room.capacity}</div>
                        {room.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {room.location}</div>}
                      </div>
                      <Button size="sm" className="mt-3 w-full"><Check className="h-3 w-3 mr-1" /> Selecionar</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && selectedRoom && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-primary/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="outline" className="mb-1">{selectedRoom.campus}</Badge>
                  <h3 className="font-semibold">{selectedRoom.name} ({selectedRoom.code})</h3>
                  <p className="text-xs text-muted-foreground">
                    {search.date} • {search.start_time} - {search.end_time} • {search.attendees_count} pessoa(s)
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>Trocar</Button>
              </div>
              {selectedRoomDetails?.equipment && selectedRoomDetails.equipment.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Package className="h-3 w-3" /> Equipamentos disponíveis</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRoomDetails.equipment.map(eq => (
                      <Badge key={eq} variant="secondary" className="text-[10px]">{eq}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedRoomDetails?.observations && (
                <p className="text-xs text-muted-foreground italic">{selectedRoomDetails.observations}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" /> Dados da reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Reunião com cliente" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">
                Sua reserva ficará <strong>pendente</strong> até aprovação da nossa equipe.
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/portal-cliente/dashboard')}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Solicitar reserva
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
