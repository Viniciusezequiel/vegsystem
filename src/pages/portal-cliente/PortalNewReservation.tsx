import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Loader2,
  MapPin,
  Package,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFindAvailableRooms, type AvailableRoom } from '@/hooks/useRoomReservations';
import { supabase } from '@/integrations/supabase/client';
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
    void refetch();
  };

  const handleSelect = async (room: AvailableRoom) => {
    setSelectedRoom(room);
    const { data } = await supabase
      .from('reservation_rooms')
      .select('observations, equipment')
      .eq('id', room.id)
      .maybeSingle();
    setSelectedRoomDetails((data as unknown as RoomDetails) || null);
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar reserva');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <Button
          variant="outline"
          size="icon"
          className="mt-0.5 h-9 w-9 shrink-0"
          onClick={() => step === 2 ? setStep(1) : navigate('/portal-cliente/dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight sm:text-[30px]">Nova reserva</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {step === 1 ? 'Informe data, horário e público para encontrar a melhor sala.' : 'Revise a sala escolhida e finalize sua solicitação.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
        <div className={`rounded-lg border px-3 py-2 ${step === 1 ? 'border-primary/35 bg-primary/8' : 'border-border/60 bg-muted/20'}`}>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Etapa 1</p>
          <p className="mt-0.5 text-sm font-medium">Disponibilidade</p>
        </div>
        <div className={`rounded-lg border px-3 py-2 ${step === 2 ? 'border-primary/35 bg-primary/8' : 'border-border/60 bg-muted/20'}`}>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Etapa 2</p>
          <p className="mt-0.5 text-sm font-medium">Confirmação</p>
        </div>
      </div>

      {step === 1 && (
        <>
          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4 text-primary" />
                Buscar disponibilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data *</Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={search.date}
                    onChange={event => setSearch(current => ({ ...current, date: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Início *</Label>
                  <Input type="time" value={search.start_time} onChange={event => setSearch(current => ({ ...current, start_time: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Término *</Label>
                  <Input type="time" value={search.end_time} onChange={event => setSearch(current => ({ ...current, end_time: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pessoas *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={search.attendees_count}
                    onChange={event => setSearch(current => ({ ...current, attendees_count: parseInt(event.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Campus</Label>
                  <Select
                    value={search.campus || 'all'}
                    onValueChange={value => setSearch(current => ({ ...current, campus: value === 'all' ? '' : value as CampusEnum }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os campus</SelectItem>
                      {campusOptions.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSearch} disabled={isLoading || !canSearch} className="sm:min-w-[130px]">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Buscar salas
                </Button>
              </div>
            </CardContent>
          </Card>

          {availableRooms !== undefined && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">
                  {availableRooms.length > 0 ? `${availableRooms.length} sala(s) disponível(is)` : 'Nenhuma sala disponível'}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {availableRooms.length > 0 ? 'Escolha uma opção para continuar.' : 'Tente outro horário, data, capacidade ou campus.'}
                </p>
              </div>

              {availableRooms.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {availableRooms.map(room => (
                    <Card
                      key={room.id}
                      className="group cursor-pointer border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card/85 hover:shadow-md"
                      onClick={() => void handleSelect(room)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{room.name}</h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">{room.code}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{room.campus}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Até {room.capacity} pessoas</span>
                          {room.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{room.location}</span>}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                          <span className="text-xs text-muted-foreground">Compatível com sua busca</span>
                          <span className="flex items-center gap-1 text-xs font-medium text-primary">Selecionar <Check className="h-3.5 w-3.5" /></span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma sala compatível foi encontrada para este período.
                </div>
              )}
            </section>
          )}
        </>
      )}

      {step === 2 && selectedRoom && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-primary/25 bg-primary/[0.03] shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{selectedRoom.campus}</Badge>
                    <span className="text-xs text-muted-foreground">{selectedRoom.code}</span>
                  </div>
                  <h3 className="mt-2 text-base font-semibold">{selectedRoom.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{search.date}</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{search.start_time} – {search.end_time}</span>
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{search.attendees_count} pessoa(s)</span>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)}>Trocar sala</Button>
              </div>

              {selectedRoomDetails?.equipment && selectedRoomDetails.equipment.length > 0 && (
                <div className="mt-4 border-t border-border/50 pt-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />Equipamentos disponíveis</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedRoomDetails.equipment.map(equipment => <Badge key={equipment} variant="outline" className="text-[10px]">{equipment}</Badge>)}
                  </div>
                </div>
              )}

              {selectedRoomDetails?.observations && (
                <p className="mt-3 rounded-lg bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{selectedRoomDetails.observations}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-primary" />Dados da reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Título *</Label>
                <Input required value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Reunião com cliente" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Textarea rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Contexto ou objetivo da reserva" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Observações</Label>
                <Textarea rows={3} value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Informações adicionais para a equipe" />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                A solicitação será enviada como <strong className="text-foreground">pendente</strong> e ficará aguardando aprovação da equipe responsável.
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => navigate('/portal-cliente/dashboard')}>Cancelar</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
