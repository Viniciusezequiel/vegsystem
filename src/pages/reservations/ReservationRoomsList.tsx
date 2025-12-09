import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useReservationRooms } from '@/hooks/useReservations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Users, MapPin, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PdfExportButton } from '@/components/ui/PdfExportButton';

export default function ReservationRoomsList() {
  const navigate = useNavigate();
  const { data: rooms, isLoading } = useReservationRooms();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = rooms?.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.location?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const pdfColumns = [
    { key: 'code', label: 'Código' },
    { key: 'name', label: 'Nome' },
    { key: 'capacity', label: 'Capacidade' },
    { key: 'location', label: 'Localização' },
    { key: 'campus', label: 'Campus' },
  ];

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
        <div className="flex gap-2">
          <PdfExportButton
            data={filteredRooms}
            columns={pdfColumns}
            title="Relatório de Ambientes"
            filename="ambientes-reserva"
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
              className="glass-card rounded-2xl p-6 cursor-pointer hover:border-primary/40 transition-all card-shine"
              onClick={() => navigate(`/reservations/room/${room.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-primary font-mono font-medium mb-1">{room.code}</p>
                  <h3 className="font-bold text-lg text-foreground">{room.name}</h3>
                </div>
                <Badge variant={room.is_active ? 'default' : 'secondary'} className={room.is_active ? 'bg-success/20 text-success' : ''}>
                  {room.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
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
    </MainLayout>
  );
}
