import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Download, MapPin, Pencil, Plus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsEventMutations } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Props = { eventId: string; event: any };

type ImportRow = {
  local: string;
  address: string;
  building: string;
  floor: string;
  room: string;
  capacity: number | null;
};

const normalizeHeader = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function readLocationWorkbook(file: File): Promise<ImportRow[]> {
  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const pick = (row: Record<string, unknown>, names: string[]) => {
      const entry = Object.entries(row).find(([key]) => names.includes(normalizeHeader(key)));
      return String(entry?.[1] ?? '').trim();
    };

    return rows.map((row) => {
      const capacityRaw = pick(row, ['CAPACIDADE', 'CAPACIDADE SALA']);
      const capacityNumber = capacityRaw === '' ? null : Number(String(capacityRaw).replace(',', '.'));
      return {
        local: pick(row, ['LOCAL', 'CAMPUS']),
        address: pick(row, ['ENDERECO', 'ENDEREÇO']),
        building: pick(row, ['PREDIO', 'PRÉDIO']),
        floor: pick(row, ['ANDAR', 'PAVIMENTO']),
        room: pick(row, ['SALA', 'AMBIENTE']),
        capacity: Number.isFinite(capacityNumber) ? capacityNumber : null,
      };
    }).filter((row) => row.local || row.address || row.building || row.floor || row.room);
  });
}

export function PsEventLocationsPanel({ eventId, event }: Props) {
  const queryClient = useQueryClient();
  const { save } = usePsEventMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(event);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', address: '' });
  const [existingLocationId, setExistingLocationId] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const { data: locations = [], refetch } = useQuery({
    queryKey: ['ps-event-locations', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data: links, error: linksError } = await (supabase as any)
        .from('ps_event_locations')
        .select('event_id,location_id,ps_locations!inner(id,name,address,active)')
        .eq('event_id', eventId);
      if (linksError) throw linksError;
      const ids = (links || []).map((item: any) => item.location_id);
      let rooms: any[] = [];
      if (ids.length) {
        const { data: roomRows, error: roomsError } = await (supabase as any)
          .from('ps_location_rooms')
          .select('id,location_id,building,floor,room,capacity,active')
          .in('location_id', ids)
          .eq('active', true)
          .order('building')
          .order('floor')
          .order('room');
        if (roomsError) throw roomsError;
        rooms = roomRows || [];
      }
      return (links || []).map((link: any) => ({
        ...link.ps_locations,
        rooms: rooms.filter((room) => room.location_id === link.location_id),
      }));
    },
  });

  const { data: availableLocations = [] } = useQuery({
    queryKey: ['ps-locations-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('ps_locations').select('id,name,address,active').eq('active', true).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const linkedIds = new Set((locations as any[]).map((item) => item.id));
  const unlinkedLocations = (availableLocations as any[]).filter((item) => !linkedIds.has(item.id));

  const importSummary = useMemo(() => {
    const buildings = new Set(importRows.map((row) => `${row.local}|||${row.building}`));
    const floors = new Set(importRows.map((row) => `${row.local}|||${row.building}|||${row.floor}`));
    return { rows: importRows.length, locations: new Set(importRows.map((row) => row.local)).size, buildings: buildings.size, floors: floors.size };
  }, [importRows]);

  const downloadModel = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      { Local: 'FUMEC', Endereço: 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150', Prédio: 'FACE I', Andar: '3º', Sala: 'A304', Capacidade: 50 },
      { Local: 'FUMEC', Endereço: 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150', Prédio: 'FACE II', Andar: '2º', Sala: 'E201', Capacidade: 50 },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Locais');
    XLSX.writeFile(workbook, 'modelo-importacao-locais.xlsx');
  };

  const chooseFile = async (file: File) => {
    try {
      const rows = await readLocationWorkbook(file);
      const invalid = rows.filter((row) => !row.local || !row.address || !row.building || !row.floor || !row.room);
      if (!rows.length) throw new Error('Nenhuma linha de local foi encontrada.');
      if (invalid.length) throw new Error(`${invalid.length} linha(s) estão sem Local, Endereço, Prédio, Andar ou Sala.`);
      setImportRows(rows);
      setImportFileName(file.name);
    } catch (error) {
      setImportRows([]);
      setImportFileName('');
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    }
  };

  const confirmImport = async () => {
    if (!importRows.length) return;
    setImporting(true);
    try {
      const { data, error } = await (supabase as any).rpc('ps_admin_import_event_locations', { p_event_id: eventId, p_rows: importRows });
      if (error) throw error;
      setImportRows([]);
      setImportFileName('');
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['ps-event-location-catalog', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['ps-locations-all'] }),
      ]);
      toast.success(`${data?.rooms_upserted ?? importSummary.rows} ambiente(s) importado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível importar os locais.');
    } finally {
      setImporting(false);
    }
  };

  const createLocation = async () => {
    if (!newLocation.name.trim() || !newLocation.address.trim()) return;
    try {
      const { data, error } = await (supabase as any).rpc('ps_admin_create_and_link_event_location', {
        p_event_id: eventId,
        p_name: newLocation.name.trim(),
        p_address: newLocation.address.trim(),
      });
      if (error) throw error;
      if (!data) throw new Error('Não foi possível cadastrar o local.');
      setCreateOpen(false);
      setNewLocation({ name: '', address: '' });
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['ps-locations-all'] })]);
      toast.success('Local cadastrado e vinculado ao evento.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cadastrar o local.');
    }
  };

  const linkExisting = async () => {
    if (!existingLocationId) return;
    const { error } = await (supabase as any).from('ps_event_locations').insert({ event_id: eventId, location_id: existingLocationId });
    if (error) return toast.error(error.message);
    setExistingLocationId('');
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ['ps-event-location-catalog', eventId] });
    toast.success('Local vinculado ao evento.');
  };

  const openEdit = () => {
    setEditForm({ ...event });
    setEditOpen(true);
  };

  const saveEvent = async () => {
    if (!editForm.name?.trim() || !editForm.date) return;
    await save.mutateAsync({
      id: event.id,
      name: editForm.name.trim(),
      date: editForm.date,
      status: editForm.status,
      location: editForm.location?.trim() || null,
      coordinator_name: editForm.coordinator_name?.trim() || null,
      description: editForm.description?.trim() || null,
      notes: editForm.notes?.trim() || null,
      self_evaluation_enabled: !!editForm.self_evaluation_enabled,
    });
    setEditOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Estrutura física do evento</h2>
          <p className="text-sm text-muted-foreground">Local → Prédio → Andar → Sala. Estes dados alimentam vinculação, presença, avaliação e comunicações.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openEdit}><Pencil className="mr-2 h-4 w-4" />Editar evento</Button>
          <Button variant="outline" onClick={downloadModel}><Download className="mr-2 h-4 w-4" />Baixar modelo</Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo local</Button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">Importar locais e salas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Formato: Local, Endereço, Prédio, Andar, Sala e Capacidade. Capacidade pode ficar em branco.</p>
          <Button variant="outline" asChild>
            <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Selecionar planilha<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => event.target.files?.[0] && void chooseFile(event.target.files[0])} /></label>
          </Button>
          {importRows.length > 0 && (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="font-medium">{importFileName}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{importSummary.locations} local(is)</Badge>
                <Badge variant="secondary">{importSummary.buildings} prédio(s)</Badge>
                <Badge variant="secondary">{importSummary.floors} andar(es)</Badge>
                <Badge>{importSummary.rows} sala(s)/ambiente(s)</Badge>
              </div>
              <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void confirmImport()} disabled={importing}>{importing ? 'Importando...' : 'Confirmar importação'}</Button><Button size="sm" variant="ghost" onClick={() => { setImportRows([]); setImportFileName(''); }}>Cancelar</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      {unlinkedLocations.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5"><Label>Vincular local já cadastrado</Label><Select value={existingLocationId} onValueChange={setExistingLocationId}><SelectTrigger><SelectValue placeholder="Selecione um local" /></SelectTrigger><SelectContent>{unlinkedLocations.map((location: any) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={() => void linkExisting()} disabled={!existingLocationId}>Vincular</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {(locations as any[]).map((location) => {
          const buildings = new Set(location.rooms.map((room: any) => room.building));
          const floors = new Set(location.rooms.map((room: any) => `${room.building}|||${room.floor}`));
          return (
            <Card key={location.id} className="rounded-2xl">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />{location.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{location.address}</p></div>
                  <Badge variant="outline">{location.rooms.length} ambientes</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary"><Building2 className="mr-1 h-3 w-3" />{buildings.size} prédios</Badge><Badge variant="secondary">{floors.size} andares</Badge></div>
                {[...buildings].sort((a: any, b: any) => String(a).localeCompare(String(b), 'pt-BR')).map((building: any) => {
                  const buildingRooms = location.rooms.filter((room: any) => room.building === building);
                  return <div key={building} className="rounded-xl border p-3"><p className="font-medium">{building}</p><p className="mt-1 text-xs text-muted-foreground">{[...new Set(buildingRooms.map((room: any) => room.floor))].join(', ')} · {buildingRooms.length} ambiente(s)</p></div>;
                })}
              </CardContent>
            </Card>
          );
        })}
        {!locations.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum local vinculado. Importe uma planilha, crie um novo local ou vincule um local existente.</div>}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Novo local</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label>Nome do local *</Label><Input value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} placeholder="Ex.: FUMEC" /></div><div className="space-y-1.5"><Label>Endereço *</Label><Textarea value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} placeholder="Endereço completo" /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void createLocation()} disabled={!newLocation.name.trim() || !newLocation.address.trim()}>Cadastrar</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Editar evento</DialogTitle></DialogHeader><div className="space-y-4"><div className="space-y-1.5"><Label>Nome *</Label><Input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={editForm.date || ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div><div className="space-y-1.5"><Label>Status</Label><Select value={editForm.status || 'planejamento'} onValueChange={(value) => setEditForm({ ...editForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PS_EVENT_STATUS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-1.5"><Label>Local resumido do evento</Label><Input value={editForm.location || ''} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Ex.: FUMEC" /></div><div className="space-y-1.5"><Label>Coordenador</Label><Input value={editForm.coordinator_name || ''} onChange={(e) => setEditForm({ ...editForm, coordinator_name: e.target.value })} /></div><div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div><div className="space-y-1.5"><Label>Observações</Label><Textarea rows={3} value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button><Button onClick={() => void saveEvent()} disabled={save.isPending || !editForm.name?.trim() || !editForm.date}>{save.isPending ? 'Salvando...' : 'Salvar alterações'}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
