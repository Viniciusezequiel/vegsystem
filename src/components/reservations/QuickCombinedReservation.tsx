import { useState, useMemo } from 'react';
import { useReservationRooms, useCreateReservation } from '@/hooks/useReservations';
import { useRoomCombinations } from '@/hooks/useRoomCombinations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarPlus, Loader2, Info, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CombinedRoom {
  id: string;
  parentRoom: {
    id: string;
    code: string;
    name: string;
    capacity: number;
  };
  linkedRooms: {
    id: string;
    code: string;
    name: string;
  }[];
  displayName: string;
}

export function QuickCombinedReservation() {
  const [open, setOpen] = useState(false);
  const [selectedCombination, setSelectedCombination] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    requester_name: '',
    requester_email: '',
    requester_phone: '',
    attendees_count: 10,
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00',
    end_time: '09:00',
  });

  const { data: rooms } = useReservationRooms();
  const { data: combinations } = useRoomCombinations();
  const createReservation = useCreateReservation();

  // Build combined rooms with display names like "Sala 801/2"
  const combinedRooms = useMemo<CombinedRoom[]>(() => {
    if (!rooms || !combinations) return [];
    
    const parentIds = [...new Set(combinations.map(c => c.parent_room_id))];
    
    return parentIds.map(parentId => {
      const parentRoom = rooms.find(r => r.id === parentId);
      if (!parentRoom) return null;
      
      const linkedRoomIds = combinations
        .filter(c => c.parent_room_id === parentId)
        .map(c => c.linked_room_id);
      
      const linkedRooms = rooms.filter(r => linkedRoomIds.includes(r.id));
      
      // Create display name like "Sala 801/2" by extracting room numbers
      const allCodes = [parentRoom.code, ...linkedRooms.map(r => r.code)].sort();
      const displayName = generateCombinedName(allCodes, parentRoom.name);
      
      return {
        id: parentId,
        parentRoom: {
          id: parentRoom.id,
          code: parentRoom.code,
          name: parentRoom.name,
          capacity: parentRoom.capacity,
        },
        linkedRooms: linkedRooms.map(r => ({
          id: r.id,
          code: r.code,
          name: r.name,
        })),
        displayName,
      };
    }).filter(Boolean) as CombinedRoom[];
  }, [rooms, combinations]);

  const selectedRoom = combinedRooms.find(c => c.id === selectedCombination);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCombination) return;

    const startDatetime = `${formData.date}T${formData.start_time}:00`;
    const endDatetime = `${formData.date}T${formData.end_time}:00`;

    createReservation.mutate({
      room_id: selectedCombination,
      title: formData.title,
      requester_name: formData.requester_name,
      requester_email: formData.requester_email,
      requester_phone: formData.requester_phone || undefined,
      attendees_count: formData.attendees_count,
      start_datetime: startDatetime,
      end_datetime: endDatetime,
    }, {
      onSuccess: () => {
        setOpen(false);
        setSelectedCombination('');
        setFormData({
          title: '',
          requester_name: '',
          requester_email: '',
          requester_phone: '',
          attendees_count: 10,
          date: format(new Date(), 'yyyy-MM-dd'),
          start_time: '08:00',
          end_time: '09:00',
        });
      },
    });
  };

  if (combinedRooms.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="w-4 h-4" />
          Reservar Sala Combinada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservar Sala Combinada</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Sala Combinada *</Label>
            <Select value={selectedCombination} onValueChange={setSelectedCombination}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sala combinada" />
              </SelectTrigger>
              <SelectContent>
                {combinedRooms.map((combo) => (
                  <SelectItem key={combo.id} value={combo.id}>
                    {combo.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRoom && (
            <Alert className="bg-primary/5 border-primary/20">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                Ao reservar <strong>{selectedRoom.displayName}</strong>, as seguintes salas serão bloqueadas automaticamente:
                <span className="font-medium text-primary ml-1">
                  {selectedRoom.parentRoom.code}, {selectedRoom.linkedRooms.map(r => r.code).join(', ')}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Título da Reserva *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Reunião de Equipe"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendees">Participantes *</Label>
              <Input
                id="attendees"
                type="number"
                min={1}
                value={formData.attendees_count}
                onChange={(e) => setFormData({ ...formData, attendees_count: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Início *</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">Término *</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="requester_name">Solicitante *</Label>
            <Input
              id="requester_name"
              value={formData.requester_name}
              onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requester_email">Email *</Label>
            <Input
              id="requester_email"
              type="email"
              value={formData.requester_email}
              onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="requester_phone">Telefone</Label>
            <Input
              id="requester_phone"
              type="tel"
              value={formData.requester_phone}
              onChange={(e) => setFormData({ ...formData, requester_phone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReservation.isPending || !selectedCombination} className="gap-2">
              {createReservation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Reservar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to generate combined room names like "Sala 801/2"
function generateCombinedName(codes: string[], baseName: string): string {
  if (codes.length < 2) return baseName;
  
  // Try to extract numbers from codes
  const numbers = codes.map(code => {
    const match = code.match(/(\d+)/);
    return match ? match[1] : code;
  });
  
  // Check if we can create a pattern like 801/2 (numbers ending in 1,2 or 5,6)
  if (numbers.length === 2) {
    const [num1, num2] = numbers.sort();
    const lastDigit1 = parseInt(num1.slice(-1));
    const lastDigit2 = parseInt(num2.slice(-1));
    
    // Pattern 1 and 2 or 5 and 6
    if ((lastDigit1 === 1 && lastDigit2 === 2) || (lastDigit1 === 5 && lastDigit2 === 6)) {
      const base = num1.slice(0, -1);
      return `Sala ${num1}/${lastDigit2}`;
    }
  }
  
  // Fallback: join all codes
  return `${codes.join(' + ')}`;
}
