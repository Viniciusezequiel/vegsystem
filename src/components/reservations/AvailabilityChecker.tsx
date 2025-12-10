import { useState } from 'react';
import { useFindAvailableRooms, ReservationRoom } from '@/hooks/useReservations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Search, Users, MapPin, CheckCircle2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export function AvailabilityChecker() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [attendees, setAttendees] = useState(1);
  const [campus, setCampus] = useState<CampusEnum | 'all'>('all');
  const [availableRooms, setAvailableRooms] = useState<ReservationRoom[] | null>(null);

  const findAvailableRooms = useFindAvailableRooms();

  const handleSearch = () => {
    if (!date || !startTime || !endTime) return;

    const start_datetime = `${date}T${startTime}:00`;
    const end_datetime = `${date}T${endTime}:00`;

    findAvailableRooms.mutate(
      {
        start_datetime,
        end_datetime,
        attendees_count: attendees,
        campus: campus === 'all' ? undefined : campus,
      },
      {
        onSuccess: (data) => {
          setAvailableRooms(data);
        },
      }
    );
  };

  const handleReset = () => {
    setDate('');
    setStartTime('');
    setEndTime('');
    setAttendees(1);
    setCampus('all');
    setAvailableRooms(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) handleReset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Search className="w-4 h-4" />
          Verificar Disponibilidade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Verificar Disponibilidade de Salas</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Form */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="check-date">Data</Label>
              <DatePickerInput
                value={date}
                onChange={setDate}
                placeholder="Selecionar data"
              />
            </div>
            <div>
              <Label htmlFor="check-attendees">Nº de Pessoas</Label>
              <Input
                id="check-attendees"
                type="number"
                min={1}
                value={attendees}
                onChange={(e) => setAttendees(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="check-start">Horário Início</Label>
              <Input
                id="check-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="check-end">Horário Término</Label>
              <Input
                id="check-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="check-campus">Campus (opcional)</Label>
              <Select value={campus} onValueChange={(v) => setCampus(v as CampusEnum | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  {campusOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={!date || !startTime || !endTime || findAvailableRooms.isPending}
            className="w-full btn-gradient"
          >
            {findAvailableRooms.isPending ? 'Buscando...' : 'Buscar Salas Disponíveis'}
          </Button>

          {/* Results */}
          {availableRooms !== null && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">
                {availableRooms.length > 0 
                  ? `${availableRooms.length} sala(s) disponível(is)`
                  : 'Nenhuma sala disponível para este horário'}
              </h3>
              
              {availableRooms.length > 0 && (
                <div className="space-y-3">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/30"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="font-semibold text-foreground">{room.name}</span>
                          <span className="text-xs text-primary font-mono">({room.code})</span>
                        </div>
                        <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{room.capacity} pessoas</span>
                          </div>
                          {room.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{room.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{room.campus}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
