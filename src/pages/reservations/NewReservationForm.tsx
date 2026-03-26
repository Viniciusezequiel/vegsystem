import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { useReservationRooms, useCreateReservation } from '@/hooks/useRoomReservations';
import { toast } from 'sonner';

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function NewReservationForm() {
  const navigate = useNavigate();
  const [campusFilter, setCampusFilter] = useState('');
  const { data: rooms, isLoading: roomsLoading } = useReservationRooms(campusFilter || undefined);
  const createReservation = useCreateReservation();

  const [form, setForm] = useState({
    title: '',
    description: '',
    room_id: '',
    date: '',
    start_time: '',
    end_time: '',
    attendees_count: 1,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title || !form.room_id || !form.date || !form.start_time || !form.end_time) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const start_datetime = `${form.date}T${form.start_time}:00`;
    const end_datetime = `${form.date}T${form.end_time}:00`;

    if (end_datetime <= start_datetime) {
      toast.error('O horário de término deve ser após o início.');
      return;
    }

    try {
      await createReservation.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        room_id: form.room_id,
        start_datetime,
        end_datetime,
        attendees_count: form.attendees_count,
        notes: form.notes || undefined,
      });
      navigate('/reservations');
    } catch {
      // error handled by hook
    }
  };

  const activeRooms = rooms?.filter(r => r.is_active) || [];

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/reservations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Nova Reserva</h1>
            <p className="text-sm text-muted-foreground">Solicite a reserva de uma sala</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Campus *</Label>
                  <Select value={campusFilter} onValueChange={v => { setCampusFilter(v); setForm(f => ({ ...f, room_id: '' })); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                    <SelectContent>
                      {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Sala *</Label>
                  <Select value={form.room_id} onValueChange={v => setForm(f => ({ ...f, room_id: v }))} disabled={!campusFilter || roomsLoading}>
                    <SelectTrigger><SelectValue placeholder={roomsLoading ? 'Carregando...' : 'Selecione a sala'} /></SelectTrigger>
                    <SelectContent>
                      {activeRooms.map(r => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.code} - {r.name} (Cap: {r.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Início *</Label>
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Término *</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>Nº de Participantes</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.attendees_count}
                  onChange={e => setForm(f => ({ ...f, attendees_count: parseInt(e.target.value) || 1 }))}
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/reservations')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createReservation.isPending}>
                  {createReservation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Solicitar Reserva
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </MainLayout>
  );
}
