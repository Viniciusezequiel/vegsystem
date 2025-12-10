import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservations, useReservationRooms, useUpdateReservation, Reservation } from '@/hooks/useReservations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Search, Plus, Calendar, Clock, Users, Eye, Check, X, Pin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { ReservationDetailsDialog } from '@/components/reservations/ReservationDetailsDialog';
import { Constants } from '@/integrations/supabase/types';

const statusConfig = {
  pending: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  confirmed: { label: 'Confirmada', className: 'bg-success/20 text-success border-success/30' },
  cancelled: { label: 'Cancelada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  completed: { label: 'Concluída', className: 'bg-muted text-muted-foreground border-border' },
};

export default function ReservationsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  const { data: rooms } = useReservationRooms();
  
  // Build filters for query
  const queryFilters: { roomId?: string; status?: string; dateFrom?: string; dateTo?: string } = {};
  if (statusFilter !== 'all') queryFilters.status = statusFilter;
  if (dateFilter) {
    const selectedDate = new Date(dateFilter);
    queryFilters.dateFrom = startOfDay(selectedDate).toISOString();
    queryFilters.dateTo = endOfDay(selectedDate).toISOString();
  }
  
  const { data: reservations, isLoading } = useReservations(
    Object.keys(queryFilters).length > 0 ? queryFilters : undefined
  );
  const updateReservation = useUpdateReservation();

  const filteredReservations = reservations?.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.requester_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.requester_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.reservation_rooms?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCampus = campusFilter === 'all' || res.reservation_rooms?.campus === campusFilter;
    
    const matchesType = typeFilter === 'all' || 
      (typeFilter === 'fixed' && res.is_fixed) ||
      (typeFilter === 'free' && res.is_external && !res.is_fixed) ||
      (typeFilter === 'regular' && !res.is_external && !res.is_fixed);
    
    return matchesSearch && matchesCampus && matchesType;
  }) || [];

  const handleStatusChange = (id: string, status: string) => {
    updateReservation.mutate({ id, status: status as Reservation['status'] });
  };

  const pdfColumns = [
    { header: 'Ambiente', accessor: 'reservation_rooms.name' },
    { header: 'Título', accessor: 'title' },
    { header: 'Solicitante', accessor: 'requester_name' },
    { header: 'Início', accessor: 'start_datetime' },
    { header: 'Término', accessor: 'end_datetime' },
    { header: 'Tipo', accessor: 'type' },
    { header: 'Status', accessor: 'status' },
  ];

  const pdfFilters = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pendente' },
        { value: 'confirmed', label: 'Confirmada' },
        { value: 'cancelled', label: 'Cancelada' },
        { value: 'completed', label: 'Concluída' },
      ],
    },
    {
      key: 'campus',
      label: 'Campus',
      options: Constants.public.Enums.campus_enum.map(c => ({ value: c, label: c })),
    },
    {
      key: 'type',
      label: 'Tipo',
      options: [
        { value: 'fixed', label: 'Reserva Fixa' },
        { value: 'free', label: 'Reserva Livre' },
        { value: 'regular', label: 'Reserva Regular' },
      ],
    },
  ];

  const getReservationType = (res: Reservation) => {
    if (res.is_fixed) return 'Reserva Fixa';
    if (res.is_external) return 'Reserva Livre';
    return 'Reserva Regular';
  };

  const getReservationTypeValue = (res: Reservation) => {
    if (res.is_fixed) return 'fixed';
    if (res.is_external) return 'free';
    return 'regular';
  };

  const formatDataForPdf = (data: Reservation[]) => {
    return data.map(res => ({
      ...res,
      'reservation_rooms.name': res.reservation_rooms?.name || '',
      campus: res.reservation_rooms?.campus || '',
      start_datetime: format(new Date(res.start_datetime), 'dd/MM/yyyy HH:mm'),
      end_datetime: format(new Date(res.end_datetime), 'dd/MM/yyyy HH:mm'),
      type: getReservationTypeValue(res),
      status: statusConfig[res.status]?.label || res.status,
    }));
  };

  return (
    <MainLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Reservas</h1>
          </div>
          <p className="page-subtitle">Gerencie todas as reservas de ambientes</p>
        </div>
        <div className="flex gap-2">
          <PdfExportButton
            data={formatDataForPdf(filteredReservations)}
            columns={pdfColumns}
            filters={pdfFilters}
            title="Relatório de Reservas"
            filename="reservas"
          />
          <Button onClick={() => navigate('/reservations/calendar')} variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            Calendário
          </Button>
          <Button onClick={() => navigate('/reservations/new')} className="gap-2 btn-gradient">
            <Plus className="w-4 h-4" />
            Nova Reserva
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, solicitante ou ambiente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-secondary/50">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
        <Select value={campusFilter} onValueChange={setCampusFilter}>
          <SelectTrigger className="w-48 bg-secondary/50">
            <SelectValue placeholder="Filtrar por campus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os campus</SelectItem>
            {Constants.public.Enums.campus_enum.map((campus) => (
              <SelectItem key={campus} value={campus}>
                {campus}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48 bg-secondary/50">
            <SelectValue placeholder="Tipo de reserva" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="fixed">Reserva Fixa</SelectItem>
            <SelectItem value="free">Reserva Livre</SelectItem>
            <SelectItem value="regular">Reserva Regular</SelectItem>
          </SelectContent>
        </Select>
        <div className="w-48">
          <DatePickerInput
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Filtrar por dia"
          />
        </div>
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
            Limpar data
          </Button>
        )}
      </div>

      {/* Reservations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map((reservation) => (
            <div
              key={reservation.id}
              className="glass-card rounded-2xl p-6 hover:border-primary/40 transition-all card-shine"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{reservation.title}</h3>
                      <p className="text-sm text-primary font-medium">
                        {reservation.reservation_rooms?.name} ({reservation.reservation_rooms?.code})
                      </p>
                    </div>
                    <Badge className={`${statusConfig[reservation.status].className} border`}>
                      {statusConfig[reservation.status].label}
                    </Badge>
                    {reservation.is_fixed && (
                      <Badge variant="outline" className="border-primary text-primary gap-1">
                        <Pin className="w-3 h-3" />
                        Fixa
                      </Badge>
                    )}
                    {reservation.is_external && !reservation.is_fixed && (
                      <Badge variant="outline" className="border-accent text-accent gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Livre
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-accent" />
                      <span>{reservation.requester_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>
                        {format(new Date(reservation.start_datetime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {' → '}
                        {format(new Date(reservation.end_datetime), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-success" />
                      <span>{reservation.attendees_count} participantes</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedReservation(reservation)}
                    className="gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Detalhes
                  </Button>
                  {reservation.status === 'pending' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(reservation.id, 'confirmed')}
                        className="gap-1 text-success hover:text-success hover:bg-success/10"
                      >
                        <Check className="w-4 h-4" />
                        Confirmar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(reservation.id, 'cancelled')}
                        className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredReservations.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma reserva encontrada</h3>
          <p className="text-muted-foreground">Tente ajustar os filtros ou crie uma nova reserva.</p>
        </div>
      )}

      {/* Details Dialog */}
      <ReservationDetailsDialog
        reservation={selectedReservation}
        open={!!selectedReservation}
        onOpenChange={(open) => !open && setSelectedReservation(null)}
      />
    </MainLayout>
  );
}
