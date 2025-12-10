import { useState, useMemo } from 'react';
import { useFindAvailableRooms, useReservations, ReservationRoom, Reservation } from '@/hooks/useReservations';
import { useExternalBookingSettings } from '@/hooks/useAppSettings';
import { useCreateExternalReservation } from '@/hooks/useExternalReservation';
import { useEquipmentList } from '@/hooks/useEquipment';
import { useCreateExternalEquipmentRequest, useExternalEquipmentRequestsByEmail } from '@/hooks/useExternalEquipmentRequests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, MapPin, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock, List, User, Lock, Package, Box } from 'lucide-react';
import { z } from 'zod';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import batmanLogo from '@/assets/batman-logo.png';

const searchSchema = z.object({
  attendees_count: z.number().min(1, 'Mínimo 1 participante'),
  start_date: z.string().min(1, 'Data obrigatória'),
  start_time: z.string().min(1, 'Horário de início obrigatório'),
  end_time: z.string().min(1, 'Horário de término obrigatório'),
});

const bookingSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres'),
  requester_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  requester_email: z.string().email('Email inválido'),
  requester_phone: z.string().optional(),
  description: z.string().optional(),
});

const equipmentRequestSchema = z.object({
  equipment_name: z.string().min(3, 'Nome do equipamento obrigatório'),
  quantity_requested: z.number().min(1, 'Mínimo 1 unidade'),
  requester_name: z.string().min(3, 'Nome obrigatório'),
  requester_email: z.string().email('Email inválido'),
  requester_phone: z.string().min(8, 'Telefone obrigatório'),
  purpose: z.string().min(10, 'Descreva a finalidade'),
  requested_date: z.string().min(1, 'Data obrigatória'),
  expected_return_date: z.string().min(1, 'Data de devolução obrigatória'),
});

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'default' },
  confirmed: { label: 'Confirmada', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  completed: { label: 'Concluída', variant: 'outline' },
  approved: { label: 'Aprovada', variant: 'secondary' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  loaned: { label: 'Emprestado', variant: 'outline' },
  returned: { label: 'Devolvido', variant: 'outline' },
};

export default function ExternalBooking() {
  const findRooms = useFindAvailableRooms();
  const createExternalReservation = useCreateExternalReservation();
  const { data: allReservations } = useReservations();
  const { data: bookingSettings, isLoading: settingsLoading } = useExternalBookingSettings();
  const { data: equipment } = useEquipmentList();
  const createEquipmentRequest = useCreateExternalEquipmentRequest();

  // Check if booking is blocked globally
  const isBookingBlocked = useMemo(() => {
    if (!bookingSettings?.blocked) return false;
    if (bookingSettings.blocked_until) {
      return isBefore(new Date(), new Date(bookingSettings.blocked_until));
    }
    return true;
  }, [bookingSettings]);

  // Check if a specific room is blocked for a specific date
  const isRoomBlockedForDate = (roomId: string, date: string): { blocked: boolean; message?: string } => {
    if (!bookingSettings?.blocked_periods || bookingSettings.blocked_periods.length === 0) {
      return { blocked: false };
    }

    const selectedDate = new Date(date);
    
    for (const period of bookingSettings.blocked_periods) {
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);
      
      if (selectedDate >= startDate && selectedDate <= endDate) {
        if (period.room_ids.length === 0 || period.room_ids.includes(roomId)) {
          return { blocked: true, message: period.message };
        }
      }
    }
    
    return { blocked: false };
  };

  const filterBlockedRooms = (rooms: ReservationRoom[]): ReservationRoom[] => {
    if (!searchData.start_date) return rooms;
    return rooms.filter((room) => !isRoomBlockedForDate(room.id, searchData.start_date).blocked);
  };

  const [mainTab, setMainTab] = useState<'booking' | 'equipment' | 'myreservations'>('booking');
  const [step, setStep] = useState<'search' | 'select' | 'booking' | 'success'>('search');
  const [equipmentStep, setEquipmentStep] = useState<'form' | 'success'>('form');
  const [availableRooms, setAvailableRooms] = useState<ReservationRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ReservationRoom | null>(null);
  const [searchErrors, setSearchErrors] = useState<Record<string, string>>({});
  const [bookingErrors, setBookingErrors] = useState<Record<string, string>>({});
  const [equipmentErrors, setEquipmentErrors] = useState<Record<string, string>>({});

  const [searchData, setSearchData] = useState({
    attendees_count: 10,
    start_date: '',
    start_time: '',
    end_time: '',
  });

  const [bookingData, setBookingData] = useState({
    title: '',
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    description: '',
  });

  const [equipmentData, setEquipmentData] = useState({
    equipment_id: '',
    equipment_name: '',
    quantity_requested: 1,
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    requester_organization: '',
    purpose: '',
    requested_date: '',
    expected_return_date: '',
  });

  const [emailFilter, setEmailFilter] = useState('');

  // Filter reservations by email
  const myReservations = useMemo(() => {
    if (!emailFilter || !allReservations) return [];
    return allReservations.filter(
      (r) => r.requester_email.toLowerCase() === emailFilter.toLowerCase()
    );
  }, [allReservations, emailFilter]);

  // Fetch equipment requests by email
  const { data: myEquipmentRequests } = useExternalEquipmentRequestsByEmail(emailFilter);

  // Available equipment for selection
  const availableEquipment = useMemo(() => {
    return equipment?.filter(e => e.available_quantity > 0 && e.status === 'available') || [];
  }, [equipment]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchErrors({});

    const result = searchSchema.safeParse({
      ...searchData,
      attendees_count: Number(searchData.attendees_count),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setSearchErrors(fieldErrors);
      return;
    }

    const start_datetime = `${searchData.start_date}T${searchData.start_time}:00`;
    const end_datetime = `${searchData.start_date}T${searchData.end_time}:00`;

    if (new Date(end_datetime) <= new Date(start_datetime)) {
      setSearchErrors({ end_time: 'O término deve ser após o início' });
      return;
    }

    findRooms.mutate(
      {
        start_datetime,
        end_datetime,
        attendees_count: Number(searchData.attendees_count),
      },
      {
        onSuccess: (rooms) => {
          const filteredRooms = filterBlockedRooms(rooms);
          setAvailableRooms(filteredRooms);
          setStep('select');
        },
      }
    );
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingErrors({});

    const result = bookingSchema.safeParse(bookingData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setBookingErrors(fieldErrors);
      return;
    }

    if (!selectedRoom) return;

    const start_datetime = `${searchData.start_date}T${searchData.start_time}:00`;
    const end_datetime = `${searchData.start_date}T${searchData.end_time}:00`;

    createExternalReservation.mutate(
      {
        room_id: selectedRoom.id,
        title: bookingData.title,
        requester_name: bookingData.requester_name,
        requester_email: bookingData.requester_email,
        requester_phone: bookingData.requester_phone || undefined,
        attendees_count: Number(searchData.attendees_count),
        start_datetime,
        end_datetime,
        description: bookingData.description || undefined,
      },
      {
        onSuccess: () => setStep('success'),
      }
    );
  };

  const handleEquipmentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEquipmentErrors({});

    const result = equipmentRequestSchema.safeParse({
      ...equipmentData,
      quantity_requested: Number(equipmentData.quantity_requested),
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setEquipmentErrors(fieldErrors);
      return;
    }

    if (new Date(equipmentData.expected_return_date) <= new Date(equipmentData.requested_date)) {
      setEquipmentErrors({ expected_return_date: 'A data de devolução deve ser após a data de retirada' });
      return;
    }

    await createEquipmentRequest.mutateAsync({
      equipment_id: equipmentData.equipment_id || undefined,
      equipment_name: equipmentData.equipment_name,
      quantity_requested: Number(equipmentData.quantity_requested),
      requester_name: equipmentData.requester_name,
      requester_email: equipmentData.requester_email,
      requester_phone: equipmentData.requester_phone,
      requester_organization: equipmentData.requester_organization || undefined,
      purpose: equipmentData.purpose,
      requested_date: equipmentData.requested_date,
      expected_return_date: equipmentData.expected_return_date,
    });

    setEquipmentStep('success');
  };

  const resetForm = () => {
    setStep('search');
    setAvailableRooms([]);
    setSelectedRoom(null);
    setSearchData({ attendees_count: 10, start_date: '', start_time: '', end_time: '' });
    setBookingData({ title: '', requester_name: '', requester_email: '', requester_phone: '', description: '' });
  };

  const resetEquipmentForm = () => {
    setEquipmentStep('form');
    setEquipmentData({
      equipment_id: '',
      equipment_name: '',
      quantity_requested: 1,
      requester_name: '',
      requester_email: '',
      requester_phone: '',
      requester_organization: '',
      purpose: '',
      requested_date: '',
      expected_return_date: '',
    });
  };

  const formatDateTime = (datetime: string) => {
    return format(parseISO(datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    const selected = availableEquipment.find(e => e.id === equipmentId);
    if (selected) {
      setEquipmentData({
        ...equipmentData,
        equipment_id: selected.id,
        equipment_name: selected.name,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="floating-orb w-96 h-96 bg-primary/30 -top-48 -left-48" />
      <div className="floating-orb w-80 h-80 bg-accent/20 -bottom-40 -right-40" />
      <div className="absolute inset-0 mesh-gradient opacity-30" />

      <div className="relative z-10 container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
              <img src={batmanLogo} alt="Logo" className="w-20 h-20 relative" style={{ filter: 'drop-shadow(0 0 15px hsl(265 85% 65% / 0.5))' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Portal de Solicitações</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Sistema de agendamento para clientes externos
            <Sparkles className="w-4 h-4 text-primary" />
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
            <TabsTrigger value="booking" className="gap-2">
              <Calendar className="w-4 h-4" />
              Reservas
            </TabsTrigger>
            <TabsTrigger value="equipment" className="gap-2">
              <Package className="w-4 h-4" />
              Empréstimos
            </TabsTrigger>
            <TabsTrigger value="myreservations" className="gap-2">
              <List className="w-4 h-4" />
              Consultar
            </TabsTrigger>
          </TabsList>

          {/* Booking Tab */}
          <TabsContent value="booking">
            {isBookingBlocked && (
              <Card className="glass-morphism border-warning/30 mb-6">
                <CardContent className="pt-6 text-center">
                  <Lock className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Reservas Temporariamente Indisponíveis</h3>
                  <p className="text-muted-foreground">
                    {bookingSettings?.message || 'O sistema de reservas está temporariamente fechado.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {!isBookingBlocked && (
              <>
                {/* Steps */}
                <div className="flex justify-center mb-8">
                  <div className="flex items-center gap-4">
                    {['Buscar', 'Selecionar', 'Reservar', 'Confirmação'].map((label, i) => {
                      const stepIndex = ['search', 'select', 'booking', 'success'].indexOf(step);
                      const isActive = i === stepIndex;
                      const isCompleted = i < stepIndex;
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                            isCompleted ? 'bg-success text-success-foreground' :
                            isActive ? 'gradient-primary text-primary-foreground' :
                            'bg-secondary text-muted-foreground'
                          }`}>
                            {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                          </div>
                          <span className={`text-sm hidden sm:inline ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {label}
                          </span>
                          {i < 3 && <div className="w-8 h-px bg-border" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step 1: Search */}
                {step === 'search' && (
                  <Card className="glass-morphism border-primary/20">
                    <CardHeader>
                      <CardTitle>Buscar Disponibilidade</CardTitle>
                      <CardDescription>Informe a data, horário e número de participantes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSearch} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Data *</Label>
                            <Input
                              type="date"
                              value={searchData.start_date}
                              onChange={(e) => setSearchData({ ...searchData, start_date: e.target.value })}
                              min={new Date().toISOString().split('T')[0]}
                              className={searchErrors.start_date ? 'border-destructive' : ''}
                            />
                            {searchErrors.start_date && <p className="text-xs text-destructive mt-1">{searchErrors.start_date}</p>}
                          </div>
                          <div>
                            <Label>Número de Participantes *</Label>
                            <Input
                              type="number"
                              min={1}
                              value={searchData.attendees_count}
                              onChange={(e) => setSearchData({ ...searchData, attendees_count: parseInt(e.target.value) || 1 })}
                              className={searchErrors.attendees_count ? 'border-destructive' : ''}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Horário de Início *</Label>
                            <Input
                              type="time"
                              value={searchData.start_time}
                              onChange={(e) => setSearchData({ ...searchData, start_time: e.target.value })}
                              className={searchErrors.start_time ? 'border-destructive' : ''}
                            />
                          </div>
                          <div>
                            <Label>Horário de Término *</Label>
                            <Input
                              type="time"
                              value={searchData.end_time}
                              onChange={(e) => setSearchData({ ...searchData, end_time: e.target.value })}
                              className={searchErrors.end_time ? 'border-destructive' : ''}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full btn-gradient" disabled={findRooms.isPending}>
                          {findRooms.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Buscar Ambientes Disponíveis
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Select Room */}
                {step === 'select' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" onClick={() => setStep('search')}>← Voltar</Button>
                      <p className="text-sm text-muted-foreground">{availableRooms.length} ambiente(s) disponível(is)</p>
                    </div>

                    {availableRooms.length === 0 ? (
                      <Card className="glass-morphism border-warning/30">
                        <CardContent className="pt-6 text-center">
                          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Nenhum ambiente disponível</h3>
                          <p className="text-muted-foreground mb-4">Tente outro horário ou data.</p>
                          <Button onClick={() => setStep('search')} variant="outline">Buscar Novamente</Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableRooms.map((room) => (
                          <Card
                            key={room.id}
                            className={`glass-morphism cursor-pointer transition-all hover:border-primary/40 ${
                              selectedRoom?.id === room.id ? 'border-primary ring-2 ring-primary/20' : 'border-border/30'
                            }`}
                            onClick={() => { setSelectedRoom(room); setStep('booking'); }}
                          >
                            <CardContent className="pt-6">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="text-xs text-primary font-mono">{room.code}</p>
                                  <h3 className="font-bold text-lg">{room.name}</h3>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-3">{room.description}</p>
                              <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Users className="w-4 h-4 text-accent" />
                                  <span>{room.capacity} pessoas</span>
                                </div>
                                {room.location && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <span>{room.location}</span>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Booking Form */}
                {step === 'booking' && selectedRoom && (
                  <Card className="glass-morphism border-primary/20">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Dados da Reserva</CardTitle>
                          <CardDescription>Preencha seus dados para confirmar a reserva em {selectedRoom.name}</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setStep('select')}>← Voltar</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleBooking} className="space-y-6">
                        <div>
                          <Label>Título da Reserva *</Label>
                          <Input
                            value={bookingData.title}
                            onChange={(e) => setBookingData({ ...bookingData, title: e.target.value })}
                            placeholder="Ex: Reunião de Equipe"
                            className={bookingErrors.title ? 'border-destructive' : ''}
                          />
                          {bookingErrors.title && <p className="text-xs text-destructive mt-1">{bookingErrors.title}</p>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Seu Nome Completo *</Label>
                            <Input
                              value={bookingData.requester_name}
                              onChange={(e) => setBookingData({ ...bookingData, requester_name: e.target.value })}
                              placeholder="João Silva"
                              className={bookingErrors.requester_name ? 'border-destructive' : ''}
                            />
                          </div>
                          <div>
                            <Label>Telefone</Label>
                            <Input
                              value={bookingData.requester_phone}
                              onChange={(e) => setBookingData({ ...bookingData, requester_phone: e.target.value })}
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={bookingData.requester_email}
                            onChange={(e) => setBookingData({ ...bookingData, requester_email: e.target.value })}
                            placeholder="seu.email@exemplo.com"
                            className={bookingErrors.requester_email ? 'border-destructive' : ''}
                          />
                        </div>
                        <div>
                          <Label>Descrição / Observações</Label>
                          <Textarea
                            value={bookingData.description}
                            onChange={(e) => setBookingData({ ...bookingData, description: e.target.value })}
                            placeholder="Informações adicionais..."
                            rows={3}
                          />
                        </div>
                        <Button type="submit" className="w-full btn-gradient" disabled={createExternalReservation.isPending}>
                          {createExternalReservation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Confirmar Reserva
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Step 4: Success */}
                {step === 'success' && (
                  <Card className="glass-morphism border-success/30">
                    <CardContent className="pt-8 text-center">
                      <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-success" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">Reserva Enviada!</h3>
                      <p className="text-muted-foreground mb-6">
                        Sua solicitação foi recebida e está aguardando aprovação.
                      </p>
                      <div className="flex gap-4 justify-center">
                        <Button onClick={resetForm} variant="outline">Nova Reserva</Button>
                        <Button onClick={() => { setMainTab('myreservations'); setEmailFilter(bookingData.requester_email); }} className="btn-gradient">
                          Ver Minhas Solicitações
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment">
            {equipmentStep === 'form' ? (
              <Card className="glass-morphism border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Solicitar Empréstimo de Equipamento
                  </CardTitle>
                  <CardDescription>Preencha os dados para solicitar um empréstimo</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEquipmentRequest} className="space-y-6">
                    {/* Equipment Selection */}
                    <div className="space-y-4">
                      <div>
                        <Label>Selecione um equipamento disponível</Label>
                        <Select value={equipmentData.equipment_id} onValueChange={handleEquipmentSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um equipamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableEquipment.map(eq => (
                              <SelectItem key={eq.id} value={eq.id}>
                                {eq.name} - {eq.campus} (Disponível: {eq.available_quantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Ou digite o nome do equipamento *</Label>
                        <Input
                          value={equipmentData.equipment_name}
                          onChange={(e) => setEquipmentData({ ...equipmentData, equipment_name: e.target.value })}
                          placeholder="Ex: Projetor, Notebook, etc."
                          className={equipmentErrors.equipment_name ? 'border-destructive' : ''}
                        />
                        {equipmentErrors.equipment_name && <p className="text-xs text-destructive mt-1">{equipmentErrors.equipment_name}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Quantidade *</Label>
                          <Input
                            type="number"
                            min={1}
                            value={equipmentData.quantity_requested}
                            onChange={(e) => setEquipmentData({ ...equipmentData, quantity_requested: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div>
                          <Label>Organização</Label>
                          <Input
                            value={equipmentData.requester_organization}
                            onChange={(e) => setEquipmentData({ ...equipmentData, requester_organization: e.target.value })}
                            placeholder="Nome da empresa/instituição"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Personal Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Seu Nome *</Label>
                        <Input
                          value={equipmentData.requester_name}
                          onChange={(e) => setEquipmentData({ ...equipmentData, requester_name: e.target.value })}
                          placeholder="João Silva"
                          className={equipmentErrors.requester_name ? 'border-destructive' : ''}
                        />
                      </div>
                      <div>
                        <Label>Telefone *</Label>
                        <Input
                          value={equipmentData.requester_phone}
                          onChange={(e) => setEquipmentData({ ...equipmentData, requester_phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className={equipmentErrors.requester_phone ? 'border-destructive' : ''}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={equipmentData.requester_email}
                        onChange={(e) => setEquipmentData({ ...equipmentData, requester_email: e.target.value })}
                        placeholder="seu.email@exemplo.com"
                        className={equipmentErrors.requester_email ? 'border-destructive' : ''}
                      />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data de Retirada *</Label>
                        <Input
                          type="date"
                          value={equipmentData.requested_date}
                          onChange={(e) => setEquipmentData({ ...equipmentData, requested_date: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className={equipmentErrors.requested_date ? 'border-destructive' : ''}
                        />
                      </div>
                      <div>
                        <Label>Data de Devolução *</Label>
                        <Input
                          type="date"
                          value={equipmentData.expected_return_date}
                          onChange={(e) => setEquipmentData({ ...equipmentData, expected_return_date: e.target.value })}
                          min={equipmentData.requested_date || new Date().toISOString().split('T')[0]}
                          className={equipmentErrors.expected_return_date ? 'border-destructive' : ''}
                        />
                        {equipmentErrors.expected_return_date && <p className="text-xs text-destructive mt-1">{equipmentErrors.expected_return_date}</p>}
                      </div>
                    </div>

                    <div>
                      <Label>Finalidade / Justificativa *</Label>
                      <Textarea
                        value={equipmentData.purpose}
                        onChange={(e) => setEquipmentData({ ...equipmentData, purpose: e.target.value })}
                        placeholder="Descreva para que será utilizado o equipamento..."
                        rows={3}
                        className={equipmentErrors.purpose ? 'border-destructive' : ''}
                      />
                      {equipmentErrors.purpose && <p className="text-xs text-destructive mt-1">{equipmentErrors.purpose}</p>}
                    </div>

                    <Button type="submit" className="w-full btn-gradient" disabled={createEquipmentRequest.isPending}>
                      {createEquipmentRequest.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Enviar Solicitação
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-morphism border-success/30">
                <CardContent className="pt-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Solicitação Enviada!</h3>
                  <p className="text-muted-foreground mb-6">
                    Sua solicitação de empréstimo foi recebida e será analisada pela equipe.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={resetEquipmentForm} variant="outline">Nova Solicitação</Button>
                    <Button onClick={() => { setMainTab('myreservations'); setEmailFilter(equipmentData.requester_email); }} className="btn-gradient">
                      Ver Minhas Solicitações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Requests Tab */}
          <TabsContent value="myreservations">
            <Card className="glass-morphism border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Minhas Solicitações
                </CardTitle>
                <CardDescription>Digite seu email para visualizar suas solicitações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Email cadastrado</Label>
                  <Input
                    type="email"
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                  />
                </div>

                {emailFilter && (
                  <Tabs defaultValue="reservations">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="reservations" className="gap-1">
                        <Calendar className="w-3 h-3" />
                        Reservas
                      </TabsTrigger>
                      <TabsTrigger value="equipment" className="gap-1">
                        <Package className="w-3 h-3" />
                        Empréstimos
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="reservations" className="mt-4">
                      {myReservations.length === 0 ? (
                        <div className="text-center py-8">
                          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Nenhuma reserva encontrada</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {myReservations.map((reservation) => (
                            <Card key={reservation.id} className="border-border/30">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold">{reservation.title}</h4>
                                    <p className="text-sm text-primary">{reservation.reservation_rooms?.name}</p>
                                  </div>
                                  <Badge variant={statusLabels[reservation.status]?.variant || 'default'}>
                                    {statusLabels[reservation.status]?.label || reservation.status}
                                  </Badge>
                                </div>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatDateTime(reservation.start_datetime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    <span>{reservation.attendees_count} participantes</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="equipment" className="mt-4">
                      {!myEquipmentRequests || myEquipmentRequests.length === 0 ? (
                        <div className="text-center py-8">
                          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Nenhuma solicitação de empréstimo encontrada</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {myEquipmentRequests.map((request) => (
                            <Card key={request.id} className="border-border/30">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold">{request.equipment_name}</h4>
                                    <p className="text-sm text-muted-foreground">Qtd: {request.quantity_requested}</p>
                                  </div>
                                  <Badge variant={statusLabels[request.status]?.variant || 'default'}>
                                    {statusLabels[request.status]?.label || request.status}
                                  </Badge>
                                </div>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{format(parseISO(request.requested_date), 'dd/MM/yyyy')}</span>
                                  </div>
                                </div>
                                {request.admin_notes && (
                                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/30">
                                    {request.admin_notes}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
