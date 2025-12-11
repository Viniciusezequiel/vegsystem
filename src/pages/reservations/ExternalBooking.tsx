import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFindAvailableRooms, useReservations, ReservationRoom, Reservation } from '@/hooks/useReservations';
import { useExternalBookingSettings } from '@/hooks/useAppSettings';
import { useCreateExternalReservation } from '@/hooks/useExternalReservation';
import { useEquipmentList } from '@/hooks/useEquipment';
import { useCreateExternalEquipmentRequest, useExternalEquipmentRequestsByEmail } from '@/hooks/useExternalEquipmentRequests';
import { useExternalUserProfile } from '@/hooks/useExternalUsers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Users, MapPin, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock, List, User, Lock, Package, Box, LogOut, Plus, Minus } from 'lucide-react';
import { z } from 'zod';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import vegSystemLogo from '@/assets/veg-system-logo.png';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { DatePickerInput } from '@/components/ui/DatePickerInput';

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

interface SelectedEquipment {
  equipment_id: string;
  equipment_name: string;
  quantity: number;
  max_available: number;
}

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
  const navigate = useNavigate();
  const findRooms = useFindAvailableRooms();
  const createExternalReservation = useCreateExternalReservation();
  const { data: allReservations } = useReservations();
  const { data: bookingSettings, isLoading: settingsLoading } = useExternalBookingSettings();
  const { data: equipment } = useEquipmentList();
  const createEquipmentRequest = useCreateExternalEquipmentRequest();
  const { data: externalUserProfile } = useExternalUserProfile();

  // Current user state
  const [currentUser, setCurrentUser] = useState<{ email: string; full_name?: string; phone?: string; cpf?: string } | null>(null);

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

  // Fetch current user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userData = {
          email: user.email || '',
          full_name: user.user_metadata?.full_name || '',
          phone: user.user_metadata?.phone || '',
          cpf: user.user_metadata?.cpf || '',
        };
        setCurrentUser(userData);
        setEmailFilter(userData.email);
      }
    };
    fetchUser();
  }, []);

  // Update form data when external user profile loads
  useEffect(() => {
    if (externalUserProfile) {
      setBookingData(prev => ({
        ...prev,
        requester_name: externalUserProfile.full_name || prev.requester_name,
        requester_email: externalUserProfile.email || prev.requester_email,
        requester_phone: externalUserProfile.phone || prev.requester_phone,
      }));
      setEquipmentFormData(prev => ({
        ...prev,
        requester_name: externalUserProfile.full_name || prev.requester_name,
        requester_email: externalUserProfile.email || prev.requester_email,
        requester_phone: externalUserProfile.phone || prev.requester_phone,
      }));
      if (externalUserProfile.email) {
        setEmailFilter(externalUserProfile.email);
      }
    }
  }, [externalUserProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/booking-auth');
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

  // Multi-select equipment state
  const [selectedEquipments, setSelectedEquipments] = useState<SelectedEquipment[]>([]);
  const [equipmentFormData, setEquipmentFormData] = useState({
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
        is_external: true, // Apply 15 min buffer for external reservations
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

  // Handle equipment toggle
  const handleToggleEquipment = (eq: typeof availableEquipment[0]) => {
    setSelectedEquipments(prev => {
      const existing = prev.find(e => e.equipment_id === eq.id);
      if (existing) {
        return prev.filter(e => e.equipment_id !== eq.id);
      }
      return [...prev, {
        equipment_id: eq.id,
        equipment_name: eq.name,
        quantity: 1,
        max_available: eq.available_quantity,
      }];
    });
  };

  // Handle quantity change
  const handleQuantityChange = (equipmentId: string, delta: number) => {
    setSelectedEquipments(prev =>
      prev.map(eq => {
        if (eq.equipment_id === equipmentId) {
          const newQty = Math.max(1, Math.min(eq.max_available, eq.quantity + delta));
          return { ...eq, quantity: newQty };
        }
        return eq;
      })
    );
  };

  const handleEquipmentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEquipmentErrors({});

    // Validate
    if (selectedEquipments.length === 0) {
      setEquipmentErrors({ equipment: 'Selecione pelo menos um equipamento' });
      return;
    }
    if (!equipmentFormData.requester_name || equipmentFormData.requester_name.length < 3) {
      setEquipmentErrors({ requester_name: 'Nome obrigatório' });
      return;
    }
    if (!equipmentFormData.requester_email) {
      setEquipmentErrors({ requester_email: 'Email obrigatório' });
      return;
    }
    if (!equipmentFormData.requester_phone || equipmentFormData.requester_phone.length < 8) {
      setEquipmentErrors({ requester_phone: 'Telefone obrigatório' });
      return;
    }
    if (!equipmentFormData.purpose || equipmentFormData.purpose.length < 10) {
      setEquipmentErrors({ purpose: 'Descreva a finalidade (mín. 10 caracteres)' });
      return;
    }
    if (!equipmentFormData.requested_date) {
      setEquipmentErrors({ requested_date: 'Data obrigatória' });
      return;
    }
    if (!equipmentFormData.expected_return_date) {
      setEquipmentErrors({ expected_return_date: 'Data de devolução obrigatória' });
      return;
    }

    if (new Date(equipmentFormData.expected_return_date) <= new Date(equipmentFormData.requested_date)) {
      setEquipmentErrors({ expected_return_date: 'A data de devolução deve ser após a data de retirada' });
      return;
    }

    // Create requests for each equipment
    for (const eq of selectedEquipments) {
      await createEquipmentRequest.mutateAsync({
        equipment_id: eq.equipment_id,
        equipment_name: eq.equipment_name,
        quantity_requested: eq.quantity,
        requester_name: equipmentFormData.requester_name,
        requester_email: equipmentFormData.requester_email,
        requester_phone: equipmentFormData.requester_phone,
        requester_organization: equipmentFormData.requester_organization || undefined,
        purpose: equipmentFormData.purpose,
        requested_date: equipmentFormData.requested_date,
        expected_return_date: equipmentFormData.expected_return_date,
      });
    }

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
    setSelectedEquipments([]);
    setEquipmentFormData({
      requester_name: externalUserProfile?.full_name || '',
      requester_email: externalUserProfile?.email || '',
      requester_phone: externalUserProfile?.phone || '',
      requester_organization: '',
      purpose: '',
      requested_date: '',
      expected_return_date: '',
    });
  };

  const formatDateTime = (datetime: string) => {
    return format(parseISO(datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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
          {/* Top bar with theme toggle and logout */}
          <div className="flex justify-between items-center mb-4">
            <ThemeToggle collapsed />
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
          
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl scale-150 animate-pulse" />
              <img src={vegSystemLogo} alt="VEG System Logo" className="w-20 h-20 relative" style={{ filter: 'drop-shadow(0 0 15px hsl(265 85% 65% / 0.5))' }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold gradient-text mb-2">VEG System</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Olá, {externalUserProfile?.full_name || currentUser?.full_name || currentUser?.email || 'Usuário'}
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
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Buscar Salas Disponíveis
                      </CardTitle>
                      <CardDescription>Informe os detalhes da sua reserva</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSearch} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Data *</Label>
                            <DatePickerInput
                              value={searchData.start_date}
                              onChange={(value) => setSearchData({ ...searchData, start_date: value })}
                              placeholder="Selecionar data"
                              className={searchErrors.start_date ? 'border-destructive' : ''}
                            />
                            {searchErrors.start_date && <p className="text-xs text-destructive mt-1">{searchErrors.start_date}</p>}
                          </div>
                          <div>
                            <Label>Participantes *</Label>
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
                            <Label>Início *</Label>
                            <Input
                              type="time"
                              value={searchData.start_time}
                              onChange={(e) => setSearchData({ ...searchData, start_time: e.target.value })}
                              className={searchErrors.start_time ? 'border-destructive' : ''}
                            />
                          </div>
                          <div>
                            <Label>Término *</Label>
                            <Input
                              type="time"
                              value={searchData.end_time}
                              onChange={(e) => setSearchData({ ...searchData, end_time: e.target.value })}
                              className={searchErrors.end_time ? 'border-destructive' : ''}
                            />
                            {searchErrors.end_time && <p className="text-xs text-destructive mt-1">{searchErrors.end_time}</p>}
                          </div>
                        </div>
                        <Button type="submit" className="w-full btn-gradient" disabled={findRooms.isPending}>
                          {findRooms.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Buscar Salas
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* Step 2: Select Room */}
                {step === 'select' && (
                  <Card className="glass-morphism border-primary/20">
                    <CardHeader>
                      <CardTitle>Salas Disponíveis</CardTitle>
                      <CardDescription>
                        {searchData.start_date} • {searchData.start_time} - {searchData.end_time} • {searchData.attendees_count} participantes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {availableRooms.length === 0 ? (
                        <div className="text-center py-8">
                          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
                          <p className="text-muted-foreground">Nenhuma sala disponível para o horário selecionado.</p>
                          <Button variant="outline" onClick={() => setStep('search')} className="mt-4">
                            Alterar busca
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {availableRooms.map((room) => (
                            <div
                              key={room.id}
                              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                selectedRoom?.id === room.id
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedRoom(room)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-semibold">{room.name}</h4>
                                  <p className="text-sm text-muted-foreground">{room.code}</p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="secondary">{room.capacity} pessoas</Badge>
                                  <p className="text-xs text-muted-foreground mt-1">{room.campus}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-4">
                            <Button variant="outline" onClick={() => setStep('search')}>Voltar</Button>
                            <Button 
                              className="flex-1 btn-gradient" 
                              disabled={!selectedRoom}
                              onClick={() => setStep('booking')}
                            >
                              Continuar
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Booking Form */}
                {step === 'booking' && selectedRoom && (
                  <Card className="glass-morphism border-primary/20">
                    <CardHeader>
                      <CardTitle>Dados da Reserva</CardTitle>
                      <CardDescription>
                        {selectedRoom.name} • {searchData.start_date} • {searchData.start_time} - {searchData.end_time}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleBooking} className="space-y-4">
                        <div>
                          <Label>Título do Evento *</Label>
                          <Input
                            value={bookingData.title}
                            onChange={(e) => setBookingData({ ...bookingData, title: e.target.value })}
                            placeholder="Ex: Reunião de Planejamento"
                            className={bookingErrors.title ? 'border-destructive' : ''}
                          />
                          {bookingErrors.title && <p className="text-xs text-destructive mt-1">{bookingErrors.title}</p>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Seu Nome *</Label>
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
                        <div className="flex gap-2">
                          <Button variant="outline" type="button" onClick={() => setStep('select')}>Voltar</Button>
                          <Button type="submit" className="flex-1 btn-gradient" disabled={createExternalReservation.isPending}>
                            {createExternalReservation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar Reserva
                          </Button>
                        </div>
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
                        <Button onClick={() => setMainTab('myreservations')} className="btn-gradient">
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
                    Solicitar Empréstimo de Equipamentos
                  </CardTitle>
                  <CardDescription>Selecione os equipamentos e preencha os dados</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEquipmentRequest} className="space-y-6">
                    {/* Equipment Selection */}
                    <div className="space-y-4">
                      <Label>Selecione os equipamentos *</Label>
                      {equipmentErrors.equipment && <p className="text-xs text-destructive">{equipmentErrors.equipment}</p>}
                      
                      <div className="grid gap-3 max-h-64 overflow-y-auto p-1">
                        {availableEquipment.map(eq => {
                          const isSelected = selectedEquipments.some(s => s.equipment_id === eq.id);
                          const selectedItem = selectedEquipments.find(s => s.equipment_id === eq.id);
                          
                          return (
                            <div
                              key={eq.id}
                              className={`p-4 rounded-lg border transition-all ${
                                isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleEquipment(eq)}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{eq.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {eq.campus} • Disponível: {eq.available_quantity}
                                  </p>
                                </div>
                                
                                {isSelected && selectedItem && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleQuantityChange(eq.id, -1)}
                                      disabled={selectedItem.quantity <= 1}
                                    >
                                      <Minus className="w-4 h-4" />
                                    </Button>
                                    <span className="w-8 text-center font-medium">{selectedItem.quantity}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleQuantityChange(eq.id, 1)}
                                      disabled={selectedItem.quantity >= selectedItem.max_available}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedEquipments.length > 0 && (
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <p className="text-sm font-medium">Selecionados: {selectedEquipments.length} equipamento(s)</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedEquipments.map(s => `${s.equipment_name} (${s.quantity})`).join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Personal Data */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Seu Nome *</Label>
                        <Input
                          value={equipmentFormData.requester_name}
                          onChange={(e) => setEquipmentFormData({ ...equipmentFormData, requester_name: e.target.value })}
                          placeholder="João Silva"
                          className={equipmentErrors.requester_name ? 'border-destructive' : ''}
                        />
                      </div>
                      <div>
                        <Label>Telefone *</Label>
                        <Input
                          value={equipmentFormData.requester_phone}
                          onChange={(e) => setEquipmentFormData({ ...equipmentFormData, requester_phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className={equipmentErrors.requester_phone ? 'border-destructive' : ''}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={equipmentFormData.requester_email}
                        onChange={(e) => setEquipmentFormData({ ...equipmentFormData, requester_email: e.target.value })}
                        placeholder="seu.email@exemplo.com"
                        className={equipmentErrors.requester_email ? 'border-destructive' : ''}
                      />
                    </div>

                    <div>
                      <Label>Organização</Label>
                      <Input
                        value={equipmentFormData.requester_organization}
                        onChange={(e) => setEquipmentFormData({ ...equipmentFormData, requester_organization: e.target.value })}
                        placeholder="Nome da empresa/instituição"
                      />
                    </div>

                    <div>
                      <Label>Finalidade do Empréstimo *</Label>
                      <Textarea
                        value={equipmentFormData.purpose}
                        onChange={(e) => setEquipmentFormData({ ...equipmentFormData, purpose: e.target.value })}
                        placeholder="Descreva o motivo e como será utilizado..."
                        rows={3}
                        className={equipmentErrors.purpose ? 'border-destructive' : ''}
                      />
                      {equipmentErrors.purpose && <p className="text-xs text-destructive mt-1">{equipmentErrors.purpose}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Data de Retirada *</Label>
                        <DatePickerInput
                          value={equipmentFormData.requested_date}
                          onChange={(value) => setEquipmentFormData({ ...equipmentFormData, requested_date: value })}
                          placeholder="Selecionar data"
                          className={equipmentErrors.requested_date ? 'border-destructive' : ''}
                        />
                      </div>
                      <div>
                        <Label>Data de Devolução *</Label>
                        <DatePickerInput
                          value={equipmentFormData.expected_return_date}
                          onChange={(value) => setEquipmentFormData({ ...equipmentFormData, expected_return_date: value })}
                          placeholder="Selecionar data"
                          className={equipmentErrors.expected_return_date ? 'border-destructive' : ''}
                        />
                        {equipmentErrors.expected_return_date && (
                          <p className="text-xs text-destructive mt-1">{equipmentErrors.expected_return_date}</p>
                        )}
                      </div>
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
                    Sua solicitação de empréstimo foi recebida e será analisada.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={resetEquipmentForm} variant="outline">Nova Solicitação</Button>
                    <Button onClick={() => setMainTab('myreservations')} className="btn-gradient">
                      Ver Minhas Solicitações
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Reservations Tab */}
          <TabsContent value="myreservations">
            <Card className="glass-morphism border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Minhas Solicitações
                </CardTitle>
                <CardDescription>Visualize suas reservas e empréstimos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Reservations */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Reservas de Salas
                  </h4>
                  {myReservations.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhuma reserva encontrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {myReservations.map((r) => (
                        <div key={r.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{r.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {r.reservation_rooms?.name} • {formatDateTime(r.start_datetime)}
                              </p>
                            </div>
                            <Badge variant={statusLabels[r.status]?.variant || 'default'}>
                              {statusLabels[r.status]?.label || r.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Equipment Requests */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Empréstimos de Equipamentos
                  </h4>
                  {!myEquipmentRequests || myEquipmentRequests.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum empréstimo encontrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {myEquipmentRequests.map((req) => (
                        <div key={req.id} className="p-3 rounded-lg border bg-card">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{req.equipment_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Qtd: {req.quantity_requested} • {format(parseISO(req.requested_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </p>
                            </div>
                            <Badge variant={statusLabels[req.status]?.variant || 'default'}>
                              {statusLabels[req.status]?.label || req.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            Criado e Desenvolvido por{' '}
            <span className="font-medium gradient-text">VEG System</span>
          </p>
        </div>
      </div>
    </div>
  );
}
