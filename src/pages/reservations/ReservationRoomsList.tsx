import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservationRooms, useUpdateReservationRoom, useDeleteReservationRoom, ReservationRoom } from '@/hooks/useReservations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Plus, Users, MapPin, Calendar, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { RoomEditDialog } from '@/components/reservations/RoomEditDialog';
import { AvailabilityChecker } from '@/components/reservations/AvailabilityChecker';
import { ExternalBookingSettings } from '@/components/reservations/ExternalBookingSettings';
import { RecurringReservation } from '@/components/reservations/RecurringReservation';
import { RoomCombinationsDialog } from '@/components/reservations/RoomCombinationsDialog';

export default function ReservationRoomsList() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useReservationRooms();
  const updateRoom = useUpdateReservationRoom();
  const deleteRoom = useDeleteReservationRoom();
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ReservationRoom | null>(null);

  const filteredRooms = rooms?.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.location?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const pdfColumns = [
    { header: 'Código', accessor: 'code' },
    { header: 'Nome', accessor: 'name' },
    { header: 'Capacidade', accessor: 'capacity' },
    { header: 'Localização', accessor: 'location' },
    { header: 'Campus', accessor: 'campus' },
  ];

  const handleEditClick = (room: ReservationRoom) => {
    setSelectedRoom(room);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (room: ReservationRoom) => {
    setSelectedRoom(room);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedRoom) {
      deleteRoom.mutate(selectedRoom.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedRoom(null);
        },
      });
    }
  };

  const handleSaveRoom = (data: Partial<ReservationRoom>) => {
    if (!data.id) return;
    updateRoom.mutate(
      { id: data.id, ...data },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setSelectedRoom(null);
        },
      }
    );
  };

  return (
    <MainLayout>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <h1 className="page-title">Ambientes de Reserva</h1>
          </div>
          <p className="page-subtitle">Gerencie os ambientes disponíveis para reservas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PdfExportButton
            data={filteredRooms}
            columns={pdfColumns}
            title="Relatório de Ambientes"
            filename="ambientes-reserva"
          />
          <ExternalBookingSettings />
          <RoomCombinationsDialog />
          <AvailabilityChecker />
          <RecurringReservation />
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

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código ou localização..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
      </div>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-3/4 mb-4" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="glass-card rounded-2xl p-6 hover:border-primary/40 transition-all card-shine group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-primary font-mono font-medium mb-1">{room.code}</p>
                  <h3 className="font-bold text-lg text-foreground">{room.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(room)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(room)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Badge variant={room.is_active ? 'default' : 'secondary'} className={room.is_active ? 'bg-success/20 text-success' : ''}>
                    {room.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {room.description || 'Sem descrição'}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Capacidade: <strong className="text-foreground">{room.capacity} pessoas</strong></span>
                </div>
                {room.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{room.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredRooms.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum ambiente encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar os filtros de busca.</p>
        </div>
      )}

      {/* Edit Dialog */}
      <RoomEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        room={selectedRoom}
        onSave={handleSaveRoom}
        isPending={updateRoom.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ambiente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o ambiente "{selectedRoom?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoom.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
