import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Calendar,
  User,
  MapPin,
  Users,
  Search,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { useReservations, useUpdateReservation } from '@/hooks/useReservations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function ReservationApprovals() {
  const { data: reservations, isLoading } = useReservations({ status: 'pending' });
  const updateReservation = useUpdateReservation();
  const [search, setSearch] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const filteredReservations = reservations?.filter(res =>
    res.title.toLowerCase().includes(search.toLowerCase()) ||
    res.requester_name.toLowerCase().includes(search.toLowerCase()) ||
    res.reservation_rooms?.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleApprove = async (reservation: any) => {
    await updateReservation.mutateAsync({
      id: reservation.id,
      status: 'confirmed',
    });
  };

  const handleReject = async () => {
    if (!selectedReservation) return;
    
    await updateReservation.mutateAsync({
      id: selectedReservation.id,
      status: 'cancelled',
      notes: rejectionReason ? `Motivo da rejeição: ${rejectionReason}` : undefined,
    });
    
    setShowRejectDialog(false);
    setSelectedReservation(null);
    setRejectionReason('');
  };

  const openRejectDialog = (reservation: any) => {
    setSelectedReservation(reservation);
    setShowRejectDialog(true);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">Aprovação de Reservas</h1>
        </div>
        <p className="page-subtitle">Gerencie as solicitações de reserva pendentes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reservations?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {reservations?.filter(r => r.is_external).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Externos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {reservations?.filter(r => {
                    const start = new Date(r.start_datetime);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return start >= today;
                  }).length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Próximas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar reservas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Reservations List */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredReservations.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma reserva pendente de aprovação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map(reservation => (
            <Card key={reservation.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{reservation.title}</h3>
                      {reservation.is_external && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                          Externo
                        </Badge>
                      )}
                      {reservation.is_fixed && (
                        <Badge variant="secondary">
                          Fixa
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mt-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span>{reservation.reservation_rooms?.name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{reservation.requester_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{reservation.attendees_count} participantes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(reservation.start_datetime), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    
                    {reservation.description && (
                      <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                        {reservation.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => openRejectDialog(reservation)}
                      disabled={updateReservation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleApprove(reservation)}
                      disabled={updateReservation.isPending}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Reserva</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição (opcional)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reserva</Label>
              <p className="text-sm text-muted-foreground">
                {selectedReservation?.title} - {selectedReservation?.requester_name}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da Rejeição</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Conflito de horário, sala indisponível..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={updateReservation.isPending}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
