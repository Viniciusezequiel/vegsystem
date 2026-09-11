import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

export type PsLocationSelection = {
  campus: string;
  address: string;
  building: string;
  floor: string;
  room: string;
  capacity: number | null;
};

type Props = {
  eventId: string;
  value: PsLocationSelection;
  onChange: (value: PsLocationSelection) => void;
  required?: boolean;
};

const emptySelection: PsLocationSelection = {
  campus: '',
  address: '',
  building: '',
  floor: '',
  room: '',
  capacity: null,
};

export function PsLocationSelector({ eventId, value, onChange, required = true }: Props) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['ps-event-location-catalog', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data: links, error: linksError } = await (supabase as any)
        .from('ps_event_locations')
        .select('location_id, ps_locations!inner(id,name,address,active)')
        .eq('event_id', eventId);
      if (linksError) throw linksError;

      const locationIds = (links || []).map((item: any) => item.location_id);
      if (!locationIds.length) return [];

      const { data: rooms, error: roomsError } = await (supabase as any)
        .from('ps_location_rooms')
        .select('id,location_id,building,floor,room,capacity,active')
        .in('location_id', locationIds)
        .eq('active', true)
        .order('building')
        .order('floor')
        .order('room');
      if (roomsError) throw roomsError;

      const locations = new Map(
        (links || []).map((item: any) => [item.location_id, item.ps_locations])
      );

      return (rooms || []).map((room: any) => ({
        ...room,
        location: locations.get(room.location_id),
      }));
    },
  });

  const locations = useMemo(() => {
    const byName = new Map<string, { name: string; address: string }>();
    for (const row of data as any[]) {
      const location = row.location;
      if (location?.active !== false && location?.name) {
        byName.set(location.name, { name: location.name, address: location.address || '' });
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [data]);

  const rowsForCampus = useMemo(
    () => (data as any[]).filter((row) => row.location?.name === value.campus),
    [data, value.campus]
  );

  const buildings = useMemo(
    () => [...new Set(rowsForCampus.map((row) => String(row.building || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rowsForCampus]
  );

  const rowsForBuilding = useMemo(
    () => rowsForCampus.filter((row) => row.building === value.building),
    [rowsForCampus, value.building]
  );

  const floors = useMemo(
    () => [...new Set(rowsForBuilding.map((row) => String(row.floor || '').trim()).filter(Boolean))],
    [rowsForBuilding]
  );

  const rowsForFloor = useMemo(
    () => rowsForBuilding.filter((row) => row.floor === value.floor),
    [rowsForBuilding, value.floor]
  );

  const rooms = useMemo(
    () => [...rowsForFloor].sort((a, b) => String(a.room).localeCompare(String(b.room), 'pt-BR', { numeric: true })),
    [rowsForFloor]
  );

  const setCampus = (campus: string) => {
    const location = locations.find((item) => item.name === campus);
    onChange({ ...emptySelection, campus, address: location?.address || '' });
  };

  const setBuilding = (building: string) => onChange({ ...value, building, floor: '', room: '', capacity: null });
  const setFloor = (floor: string) => onChange({ ...value, floor, room: '', capacity: null });
  const setRoom = (roomName: string) => {
    const room = rooms.find((item: any) => item.room === roomName);
    onChange({ ...value, room: roomName, capacity: room?.capacity ?? null });
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando locais do evento...</p>;
  }

  if (!locations.length) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Nenhum local foi vinculado a este evento. Cadastre ou importe os locais na aba <strong>Locais</strong> antes de vincular fiscais.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Local / Campus {required ? '*' : ''}</Label>
        <Select value={value.campus} onValueChange={setCampus}>
          <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
          <SelectContent>
            {locations.map((location) => <SelectItem key={location.name} value={location.name}>{location.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {value.address && <p className="text-xs text-muted-foreground">{value.address}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Prédio {required ? '*' : ''}</Label>
        <Select value={value.building} onValueChange={setBuilding} disabled={!value.campus}>
          <SelectTrigger><SelectValue placeholder="Selecione o prédio" /></SelectTrigger>
          <SelectContent>{buildings.map((building) => <SelectItem key={building} value={building}>{building}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Andar {required ? '*' : ''}</Label>
        <Select value={value.floor} onValueChange={setFloor} disabled={!value.building}>
          <SelectTrigger><SelectValue placeholder="Selecione o andar" /></SelectTrigger>
          <SelectContent>{floors.map((floor) => <SelectItem key={floor} value={floor}>{floor}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Sala / Ambiente {required ? '*' : ''}</Label>
        <Select value={value.room} onValueChange={setRoom} disabled={!value.floor}>
          <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
          <SelectContent>
            {rooms.map((room: any) => (
              <SelectItem key={room.id} value={room.room}>
                {room.room}{room.capacity != null ? ` · capacidade ${room.capacity}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
