import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { ReservationRoom } from '@/hooks/useRoomReservations';

const campusOptions = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export interface FiltersState {
  search: string;
  startDate: string;
  endDate: string;
  status: string;
  campus: string;
  roomId: string;
}

interface Props {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  rooms: ReservationRoom[];
}

export function ReservationFiltersBar({ value, onChange, rooms }: Props) {
  const update = (patch: Partial<FiltersState>) => onChange({ ...value, ...patch });

  const filteredRooms = value.campus !== 'all'
    ? rooms.filter(r => r.campus === value.campus)
    : rooms;

  const activeFilters: Array<{ key: keyof FiltersState; label: string }> = [];
  if (value.campus !== 'all') activeFilters.push({ key: 'campus', label: `Campus: ${value.campus}` });
  if (value.roomId !== 'all') {
    const r = rooms.find(x => x.id === value.roomId);
    activeFilters.push({ key: 'roomId', label: `Sala: ${r ? r.code : value.roomId}` });
  }
  if (value.startDate) activeFilters.push({ key: 'startDate', label: `De: ${value.startDate}` });
  if (value.endDate) activeFilters.push({ key: 'endDate', label: `Até: ${value.endDate}` });

  const advancedCount = (value.campus !== 'all' ? 1 : 0) + (value.roomId !== 'all' ? 1 : 0);

  const clearAll = () => onChange({
    search: '', startDate: '', endDate: '', status: 'all', campus: 'all', roomId: 'all',
  });

  const clearOne = (key: keyof FiltersState) => {
    if (key === 'campus') update({ campus: 'all', roomId: 'all' });
    else if (key === 'roomId') update({ roomId: 'all' });
    else if (key === 'startDate') update({ startDate: '' });
    else if (key === 'endDate') update({ endDate: '' });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou solicitante..."
            value={value.search}
            onChange={e => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <DatePickerInput
            value={value.startDate}
            onChange={v => update({ startDate: v })}
            placeholder="De"
            className="w-[140px]"
          />
          <span className="text-muted-foreground text-sm">→</span>
          <DatePickerInput
            value={value.endDate}
            onChange={v => update({ endDate: v })}
            placeholder="Até"
            className="w-[140px]"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Mais filtros
              {advancedCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">{advancedCount}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="end">
            <div>
              <Label className="text-xs">Campus</Label>
              <Select value={value.campus} onValueChange={v => update({ campus: v, roomId: 'all' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Campus</SelectItem>
                  {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sala</Label>
              <Select value={value.roomId} onValueChange={v => update({ roomId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Salas</SelectItem>
                  {filteredRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={clearAll}>
              Limpar todos os filtros
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {activeFilters.map(f => (
            <Badge key={f.key} variant="secondary" className="gap-1">
              {f.label}
              <button onClick={() => clearOne(f.key)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={clearAll}>Limpar tudo</Button>
        </div>
      )}
    </div>
  );
}
