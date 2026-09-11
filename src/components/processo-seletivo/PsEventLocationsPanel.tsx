import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, MapPin, Plus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const normalizeHeader = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export type PsLocationRoomOption = {
  id: string;
  location_id: string;
  building: string;
  floor: string;
  room: string;
  capacity: number | null;
  active: boolean;
};

export type PsLocationOption = {
  id: string;
  name: string;
  address: string;
  active: boolean;
  rooms: PsLocationRoomOption[];
};

export function usePsEventLocationOptions(eventId?: string) {
  return useQuery({
    queryKey: ['ps_event_location_options', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const [{ data: links, error: linkError }, { data: locations, error: locationError }, { data: rooms, error: roomError }] = await Promise.all([
        supabase.from('ps_event_locations').select('location_id').eq('event_id', eventId!),
        supabase.from('ps_locations').select('id,name,address,active').eq('active', true).order('name'),
        supabase.from('ps_location_rooms').select('id,location_id,building,floor,room,capacity,active').eq('active', true).order('building').order('floor').order('room'),
      ]);
      if (linkError) throw linkError;
      if (locationError) throw locationError;
      if (roomError) throw roomError;
      const allowed = new Set((links || []).map((item: any) => item.location_id));
      return (locations || [])
        .filter((location: any) => allowed.has(location.id))
        .map((location: any) => ({
          ...location,
          rooms: (rooms || []).filter((room: any) => room.location_id === location.id),
        })) as PsLocationOption[];
    },
  });
}

export function PsEventLocationsPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [linkLocationId, setLinkLocationId] = useState('');
  const [importing, setImporting] = useState(false);
  const { data: eventLocations = [], isLoading } = usePsEventLocationOptions(eventId);

  const { data: allLocations = [] } = useQuery({
    queryKey: ['ps_locations_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ps_locations').select('id,name,address,active').eq('active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const linkedIds = useMemo(() => new Set(eventLocations.map(item => item.id)), [eventLocations]);
  const availableLocations = allLocations.filter((item: any) => !linkedIds.has(item.id));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ps_event_location_options', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['ps_locations_all'] }),
    ]);
  };

  const linkExisting = async () => {
    if (!linkLocationId) return;
    const { error } = await supabase.from('ps_event_locations').upsert({ event_id: eventId, location_id: linkLocationId }, { onConflict: 'event_id,location_id' });
    if (error) { toast.error(error.message); return; }
    setLinkLocationId('');
    await invalidate();
    toast.success('Local vinculado ao evento.');
  };

  const downloadTemplate = () => {
    const rows = [
      {
        Local: 'FUMEC',
        Endereço: 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150',
        Prédio: 'FACE I',
        Andar: '3º',
        Sala: 'A304',
        Capacidade: 50,
      },
      {
        Local: 'FUMEC',
        Endereço: 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150',
        Prédio: 'FACE II',
        Andar: '2º',
        Sala: 'E201',
        Capacidade: 50,
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Locais');
    XLSX.writeFile(workbook, 'modelo-importacao-locais.xlsx');
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer());
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const mapped = raw.map((row) => {
        const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
        return {
          name: clean(normalized.LOCAL),
          address: clean(normalized.ENDERECO),
          building: clean(normalized.PREDIO),
          floor: clean(normalized.ANDAR),
          room: clean(normalized.SALA),
          capacity: clean(normalized.CAPACIDADE) ? Number(String(normalized.CAPACIDADE).replace(/[^0-9]/g, '')) : null,
        };
      }).filter(row => row.name || row.address || row.building || row.floor || row.room);

      if (!mapped.length) throw new Error('A planilha não possui linhas para importar.');
      const invalid = mapped.filter(row => !row.name || !row.address || !row.building || !row.floor || !row.room);
      if (invalid.length) throw new Error(`Existem ${invalid.length} linha(s) sem Local, Endereço, Prédio, Andar ou Sala.`);

      const locationKeys = new Map<string, { name: string; address: string }>();
      for (const row of mapped) locationKeys.set(`${row.name}|||${row.address}`, { name: row.name, address: row.address });

      const resolved = new Map<string, string>();
      for (const location of locationKeys.values()) {
        const { data, error } = await supabase
          .from('ps_locations')
          .upsert({ name: location.name, address: location.address, active: true }, { onConflict: 'name,address' })
          .select('id')
          .single();
        if (error) throw error;
        resolved.set(`${location.name}|||${location.address}`, data.id);
        const { error: eventLinkError } = await supabase
          .from('ps_event_locations')
          .upsert({ event_id: eventId, location_id: data.id }, { onConflict: 'event_id,location_id' });
        if (eventLinkError) throw eventLinkError;
      }

      const roomRows = mapped.map(row => ({
        location_id: resolved.get(`${row.name}|||${row.address}`),
        building: row.building,
        floor: row.floor,
        room: row.room,
        capacity: Number.isFinite(row.capacity) ? row.capacity : null,
        active: true,
      }));
      const { error: roomError } = await supabase
        .from('ps_location_rooms')
        .upsert(roomRows as any, { onConflict: 'location_id,building,floor,room' });
      if (roomError) throw roomError;

      await invalidate();
      toast.success(`${roomRows.length} sala(s)/ambiente(s) importados e vinculados ao evento.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível importar os locais.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />Locais deste evento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={linkLocationId} onValueChange={setLinkLocationId}>
              <SelectTrigger className="sm:max-w-md"><SelectValue placeholder="Vincular local já cadastrado" /></SelectTrigger>
              <SelectContent>
                {availableLocations.map((location: any) => (
                  <SelectItem key={location.id} value={location.id}>{location.name} — {location.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void linkExisting()} disabled={!linkLocationId}>
              <Plus className="mr-2 h-4 w-4" />Vincular
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Baixar modelo</Button>
            <div>
              <Input id="ps-location-import" type="file" accept=".xlsx,.xls" className="hidden" disabled={importing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.currentTarget.value = '';
                }} />
              <Label htmlFor="ps-location-import" className="inline-flex h-10 cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                <Upload className="mr-2 h-4 w-4" />{importing ? 'Importando...' : 'Importar planilha'}
              </Label>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Formato: Local, Endereço, Prédio, Andar, Sala e Capacidade. Capacidade pode ficar vazia.</p>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando locais...</p> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {eventLocations.map((location) => {
            const buildings = new Set(location.rooms.map(room => room.building));
            const floors = new Set(location.rooms.map(room => `${room.building}|||${room.floor}`));
            return (
              <Card key={location.id} className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="font-semibold">{location.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{location.address}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{buildings.size} prédio(s)</span><span>•</span><span>{floors.size} andar(es)</span><span>•</span><span>{location.rooms.length} sala(s)/ambiente(s)</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!eventLocations.length && <p className="text-sm text-muted-foreground">Nenhum local vinculado a este evento.</p>}
        </div>
      )}
    </div>
  );
}
