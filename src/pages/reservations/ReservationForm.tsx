import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservationRooms, useCreateReservation } from '@/hooks/useReservations';
import { ExternalUser } from '@/hooks/useExternalUsers';
import { ExternalUserSelector } from '@/components/reservations/ExternalUserSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Switch } from '@/components/ui/switch';
import { Calendar, ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';

const reservationSchema = z.object({
  room_id: z.string().min(1, 'Selecione um ambiente'),
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  requester_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  requester_email: z.string().email('Email inválido'),
  requester_phone: z.string().optional(),
  requester_cpf: z.string().optional(),
  attendees_count: z.number().min(1, 'Mínimo 1 participante'),
  start_date: z.string().min(1, 'Data de início obrigatória'),
  start_time: z.string().min(1, 'Horário de início obrigatório'),
  end_date: z.string().min(1, 'Data de término obrigatória'),
  end_time: z.string().min(1, 'Horário de término obrigatório'),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export default function ReservationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { data: rooms, isLoading: roomsLoading } = useReservationRooms();
  const createReservation = useCreateReservation();

  const [isExternalReservation, setIsExternalReservation] = useState(false);
  const [selectedExternalUser, setSelectedExternalUser] = useState<ExternalUser | { full_name: string; email: string; cpf: string; phone?: string } | null>(null);

  // Get pre-filled values from URL params
  const prefilledRoom = searchParams.get('room') || '';
  const prefilledDate = searchParams.get('date') || '';
  const prefilledStart = searchParams.get('start') || '';
  const prefilledEnd = searchParams.get('end') || '';
  const prefilledAttendees = searchParams.get('attendees');

  const [formData, setFormData] = useState({
    room_id: prefilledRoom,
    title: '',
    requester_name: profile?.full_name || '',
    requester_email: '',
    requester_phone: '',
    requester_cpf: '',
    attendees_count: prefilledAttendees ? parseInt(prefilledAttendees) : 1,
    start_date: prefilledDate,
    start_time: prefilledStart,
    end_date: prefilledDate,
    end_time: prefilledEnd,
    description: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleExternalUserSelect = (user: ExternalUser | { full_name: string; email: string; cpf: string; phone?: string }) => {
    setSelectedExternalUser(user);
    setFormData(prev => ({
      ...prev,
      requester_name: user.full_name,
      requester_email: user.email,
      requester_phone: user.phone || '',
      requester_cpf: user.cpf,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = reservationSchema.safeParse({
      ...formData,
      attendees_count: Number(formData.attendees_count),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      // Scroll to first error
      const firstErrorField = document.querySelector('.border-destructive');
      firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const start_datetime = `${formData.start_date}T${formData.start_time}:00`;
    const end_datetime = `${formData.end_date}T${formData.end_time}:00`;

    if (new Date(end_datetime) <= new Date(start_datetime)) {
      setErrors({ end_time: 'O término deve ser após o início' });
      return;
    }

    createReservation.mutate(
      {
        room_id: formData.room_id,
        title: formData.title,
        requester_name: formData.requester_name,
        requester_email: formData.requester_email,
        requester_phone: formData.requester_phone || undefined,
        requester_cpf: isExternalReservation ? formData.requester_cpf : undefined,
        attendees_count: Number(formData.attendees_count),
        start_datetime,
        end_datetime,
        description: formData.description || undefined,
        notes: formData.notes || undefined,
        is_external: isExternalReservation,
        external_user_id: isExternalReservation && selectedExternalUser && 'id' in selectedExternalUser ? selectedExternalUser.id : undefined,
      },
      {
        onSuccess: () => navigate('/reservations'),
      }
    );
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="page-header">
          <Button
            variant="ghost"
            onClick={() => navigate('/reservations')}
            className="mb-4 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Nova Reserva</h1>
          </div>
          <p className="page-subtitle">Agende uma nova reserva de ambiente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Informações da Reserva</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="room_id">Ambiente *</Label>
                <Select
                  value={formData.room_id}
                  onValueChange={(value) => setFormData({ ...formData, room_id: value })}
                  disabled={roomsLoading}
                >
                  <SelectTrigger className={errors.room_id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione um ambiente" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms?.filter(r => r.is_active).map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} ({room.code}) - Cap. {room.capacity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.room_id && <p className="text-xs text-destructive mt-1">{errors.room_id}</p>}
              </div>

              <div>
                <Label htmlFor="title">Título da Reserva *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Aula de Matemática"
                  className={errors.title ? 'border-destructive' : ''}
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Data de Início *</Label>
                  <DatePickerInput
                    value={formData.start_date}
                    onChange={(value) => setFormData({ ...formData, start_date: value })}
                    placeholder="Selecionar data"
                    className={errors.start_date ? 'border-destructive' : ''}
                  />
                  {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
                </div>
                <div>
                  <Label htmlFor="start_time">Horário de Início *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className={errors.start_time ? 'border-destructive' : ''}
                  />
                  {errors.start_time && <p className="text-xs text-destructive mt-1">{errors.start_time}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="end_date">Data de Término *</Label>
                  <DatePickerInput
                    value={formData.end_date}
                    onChange={(value) => setFormData({ ...formData, end_date: value })}
                    placeholder="Selecionar data"
                    className={errors.end_date ? 'border-destructive' : ''}
                  />
                  {errors.end_date && <p className="text-xs text-destructive mt-1">{errors.end_date}</p>}
                </div>
                <div>
                  <Label htmlFor="end_time">Horário de Término *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className={errors.end_time ? 'border-destructive' : ''}
                  />
                  {errors.end_time && <p className="text-xs text-destructive mt-1">{errors.end_time}</p>}
                </div>
              </div>


              <div>
                <Label htmlFor="attendees_count">Número de Participantes *</Label>
                <Input
                  id="attendees_count"
                  type="number"
                  min={1}
                  value={formData.attendees_count}
                  onChange={(e) => setFormData({ ...formData, attendees_count: parseInt(e.target.value) || 1 })}
                  className={errors.attendees_count ? 'border-destructive' : ''}
                />
                {errors.attendees_count && <p className="text-xs text-destructive mt-1">{errors.attendees_count}</p>}
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o objetivo da reserva..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Dados do Solicitante</h2>
              <div className="flex items-center gap-2">
                <Label htmlFor="is_external" className="text-sm">Reserva para usuário externo</Label>
                <Switch
                  id="is_external"
                  checked={isExternalReservation}
                  onCheckedChange={(checked) => {
                    setIsExternalReservation(checked);
                    if (!checked) {
                      setSelectedExternalUser(null);
                      setFormData(prev => ({
                        ...prev,
                        requester_name: profile?.full_name || '',
                        requester_email: '',
                        requester_phone: '',
                        requester_cpf: '',
                      }));
                    }
                  }}
                />
              </div>
            </div>

            {isExternalReservation && (
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/30 space-y-4">
                <div className="flex items-center gap-2 text-sm text-accent">
                  <ExternalLink className="w-4 h-4" />
                  <span>Reserva vinculada a um usuário externo (aparecerá no perfil dele)</span>
                </div>
                <ExternalUserSelector
                  onSelect={handleExternalUserSelect}
                  selectedUser={selectedExternalUser as ExternalUser}
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="requester_name">Nome Completo *</Label>
                <Input
                  id="requester_name"
                  value={formData.requester_name}
                  onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                  placeholder="Nome do solicitante"
                  className={errors.requester_name ? 'border-destructive' : ''}
                  disabled={isExternalReservation && !!selectedExternalUser}
                />
                {errors.requester_name && <p className="text-xs text-destructive mt-1">{errors.requester_name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="requester_email">Email *</Label>
                  <Input
                    id="requester_email"
                    type="email"
                    value={formData.requester_email}
                    onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                    placeholder="email@exemplo.com"
                    className={errors.requester_email ? 'border-destructive' : ''}
                    disabled={isExternalReservation && !!selectedExternalUser}
                  />
                  {errors.requester_email && <p className="text-xs text-destructive mt-1">{errors.requester_email}</p>}
                </div>
                <div>
                  <Label htmlFor="requester_phone">Telefone</Label>
                  <Input
                    id="requester_phone"
                    value={formData.requester_phone}
                    onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    disabled={isExternalReservation && !!selectedExternalUser}
                  />
                </div>
              </div>

              {isExternalReservation && (
                <div>
                  <Label htmlFor="requester_cpf">CPF</Label>
                  <Input
                    id="requester_cpf"
                    value={formData.requester_cpf}
                    onChange={(e) => setFormData({ ...formData, requester_cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    disabled={!!selectedExternalUser}
                    className="font-mono"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              Por favor, corrija os campos destacados antes de continuar.
            </div>
          )}

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/reservations')}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-gradient"
              disabled={createReservation.isPending}
            >
              {createReservation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Reserva'
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
