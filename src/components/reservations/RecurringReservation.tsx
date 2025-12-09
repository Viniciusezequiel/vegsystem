import { useState } from 'react';
import { useCreateReservation, useReservationRooms } from '@/hooks/useReservations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Repeat, Loader2 } from 'lucide-react';
import { addDays, format, getDay, isBefore, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const weekDays = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function RecurringReservation() {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { data: rooms, isLoading: roomsLoading } = useReservationRooms();
  const createReservation = useCreateReservation();
  const { toast } = useToast();
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    room_id: '',
    title: '',
    requester_name: profile?.full_name || '',
    requester_email: '',
    requester_phone: '',
    attendees_count: 1,
    start_time: '',
    end_time: '',
    start_date: '',
    end_date: '',
    description: '',
    notes: '',
    selectedDays: [] as number[],
  });

  const handleDayToggle = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day],
    }));
  };

  const handleSubmit = async () => {
    if (
      !formData.room_id ||
      !formData.title ||
      !formData.requester_name ||
      !formData.requester_email ||
      !formData.start_time ||
      !formData.end_time ||
      !formData.start_date ||
      !formData.end_date ||
      formData.selectedDays.length === 0
    ) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios e selecione ao menos um dia da semana.',
        variant: 'destructive',
      });
      return;
    }

    const startDate = parseISO(formData.start_date);
    const endDate = parseISO(formData.end_date);

    if (isBefore(endDate, startDate)) {
      toast({
        title: 'Erro',
        description: 'A data final deve ser após a data inicial.',
        variant: 'destructive',
      });
      return;
    }

    // Generate all dates
    const dates: Date[] = [];
    let currentDate = startDate;
    
    while (!isBefore(endDate, currentDate)) {
      if (formData.selectedDays.includes(getDay(currentDate))) {
        dates.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
    }

    if (dates.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhuma data corresponde aos dias da semana selecionados.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    let successCount = 0;
    let errorCount = 0;

    for (const date of dates) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const start_datetime = `${dateStr}T${formData.start_time}:00`;
      const end_datetime = `${dateStr}T${formData.end_time}:00`;

      try {
        await createReservation.mutateAsync({
          room_id: formData.room_id,
          title: formData.title,
          requester_name: formData.requester_name,
          requester_email: formData.requester_email,
          requester_phone: formData.requester_phone || undefined,
          attendees_count: formData.attendees_count,
          start_datetime,
          end_datetime,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          is_external: false,
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsCreating(false);

    if (successCount > 0) {
      toast({
        title: 'Reservas criadas',
        description: `${successCount} reserva(s) criada(s) com sucesso.${errorCount > 0 ? ` ${errorCount} falhou(aram) por conflito de horário.` : ''}`,
      });
      setOpen(false);
      setFormData({
        room_id: '',
        title: '',
        requester_name: profile?.full_name || '',
        requester_email: '',
        requester_phone: '',
        attendees_count: 1,
        start_time: '',
        end_time: '',
        start_date: '',
        end_date: '',
        description: '',
        notes: '',
        selectedDays: [],
      });
    } else {
      toast({
        title: 'Erro',
        description: 'Nenhuma reserva pôde ser criada. Verifique conflitos de horário.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Repeat className="w-4 h-4" />
          Reserva Recorrente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Reservas Recorrentes</DialogTitle>
          <DialogDescription>
            Crie múltiplas reservas para os mesmos dias da semana em um período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Room & Title */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Ambiente *</Label>
              <Select
                value={formData.room_id}
                onValueChange={(v) => setFormData({ ...formData, room_id: v })}
                disabled={roomsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {rooms?.filter((r) => r.is_active).map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name} ({room.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Aula de Inglês"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Inicial *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Final *</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horário Início *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Horário Término *</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* Week Days */}
          <div>
            <Label>Dias da Semana *</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {weekDays.map((day) => (
                <label
                  key={day.value}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={formData.selectedDays.includes(day.value)}
                    onCheckedChange={() => handleDayToggle(day.value)}
                  />
                  <span className="text-sm">{day.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Attendees */}
          <div>
            <Label>Nº de Participantes *</Label>
            <Input
              type="number"
              min={1}
              value={formData.attendees_count}
              onChange={(e) =>
                setFormData({ ...formData, attendees_count: parseInt(e.target.value) || 1 })
              }
            />
          </div>

          {/* Requester Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.requester_name}
                onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.requester_email}
                onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isCreating}
            className="w-full btn-gradient"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando reservas...
              </>
            ) : (
              'Criar Reservas Recorrentes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
