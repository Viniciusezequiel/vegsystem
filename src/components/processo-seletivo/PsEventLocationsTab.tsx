import { useMemo, useState } from 'react';
import { Building2, Download, MapPin, Plus, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePsAllLocations, usePsEventLocationActions, usePsEventLocationStructure } from '@/hooks/usePsEventLocations';

type ImportRow = {
  local: string;
  address: string;
  building: string;
  floor: string;
  room: string;
  capacity: string | number | null;
};

const normalizeHeader = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

function parseLocationWorkbook(file: File) {
  return file.arrayBuffer().then(buffer => {
    const workbook = XLSX.read(buffer);
    const output: ImportRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
      for (const source of rows) {
        const normalized = Object.fromEntries(Object.entries(source).map(([key, value]) => [normalizeHeader(key), value]));
        const local = String(normalized.local ?? '').trim();
        const address = String(normalized.endereco ?? '').trim();
        const building = String(normalized.predio ?? '').trim();
        const floor = String(normalized.andar ?? '').trim();
        const room = String(normalized.sala ?? '').trim();
        const rawCapacity = String(normalized.capacidade ?? '').trim();
        const capacity = /^\d+$/.test(rawCapacity) ? Number(rawCapacity) : null;
        if (!local && !building && !floor && !room) continue;
        if (!local || !building || !floor || !room) {
          throw new Error(`Linha incompleta na aba ${sheetName}. Local, Prédio, Andar e Sala são obrigatórios.`);
        }
        output.push({ local, address, building, floor, room, capacity });
      }
    }
    return output;
  });
}

export function PsEventLocationsTab({ eventId }: { eventId: string }) {
  const { data: locations = [], isLoading } = usePsEventLocationStructure(eventId);
  const { data: allLocations = [] } = usePsAllLocations();
  const { createAndAttach, attach, importRows } = usePsEventLocationActions(eventId);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [attachId, setAttachId] = useState('');
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');

  const attachedIds = useMemo(() => new Set(locations.map(location => location.id)), [locations]);
  const availableLocations = allLocations.filter(location => !attachedIds.has(location.id));

  const previewStats = useMemo(() => ({
    locations: new Set(preview.map(row => row.local.toLowerCase())).size,
    buildings: new Set(preview.map(row => `${row.local.toLowerCase()}|${row.building.toLowerCase()}`)).size,
    floors: new Set(preview.map(row => `${row.local.toLowerCase()}|${row.building.toLowerCase()}|${row.floor.toLowerCase()}`)).size,
    rooms: new Set(preview.map(row => `${row.local.toLowerCase()}|${row.building.toLowerCase()}|${row.floor.toLowerCase()}|${row.room.toLowerCase()}`)).size,
  }), [preview]);

  const downloadModel = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        Local: 'FUMEC',
        Endereço: 'R. Cobre, 200 - Cruzeiro, Belo Horizonte - MG, 30310-150',
        Prédio: 'FCH',
        Andar: '2º',
        Sala: 'B201',
        Capacidade: 50,
      },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Locais');
    XLSX.writeFile(workbook, 'modelo-locais-processo-seletivo.xlsx');
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    try {
      const rows = await parseLocationWorkbook(file);
      if (!rows.length) throw new Error('Nenhuma sala/ambiente válido foi encontrado na planilha.');
      const unique = new Map<string, ImportRow>();
      for (const row of rows) {
        const key = [row.local, row.building, row.floor, row.room].map(value => value.trim().toLowerCase()).join('|');
        unique.set(key, row);
      }
      setPreview([...unique.values()]);
      setFileName(file.name);
      setImportOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    }
  };

  const confirmImport = async () => {
    if (!preview.length) return;
    await importRows.mutateAsync(preview.map(row => ({
      local: row.local,
      address: row.address,
      building: row.building,
      floor: row.floor,
      room: row.room,
      capacity: row.capacity,
    })));
    setImportOpen(false);
    setPreview([]);
    setFileName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo local</Button>
        <Button variant="outline" asChild>
          <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Importar locais e salas
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => { void chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
        </Button>
        <Button variant="outline" onClick={downloadModel}><Download className="mr-2 h-4 w-4" />Baixar modelo</Button>
      </div>

      {availableLocations.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>Vincular local já cadastrado</Label>
              <Select value={attachId} onValueChange={setAttachId}>
                <SelectTrigger><SelectValue placeholder="Selecione um local" /></SelectTrigger>
                <SelectContent>{availableLocations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" disabled={!attachId || attach.isPending} onClick={async () => { await attach.mutateAsync(attachId); setAttachId(''); }}>Vincular</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando locais...</p> : locations.length === 0 ? (
        <Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum local vinculado a este evento. Cadastre ou importe a estrutura antes de alocar os fiscais.</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {locations.map(location => {
            const roomCount = location.buildings.reduce((sum, building) => sum + building.rooms.length, 0);
            const totalCapacity = location.buildings.flatMap(building => building.rooms).reduce((sum, room) => sum + Number(room.capacity || 0), 0);
            return (
              <Card key={location.id} className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" />{location.name}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">{location.address || 'Endereço não informado'}</p>
                    </div>
                    <Badge variant="secondary">{roomCount} salas/ambientes</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{location.buildings.length} prédio(s){totalCapacity ? ` · capacidade cadastrada ${totalCapacity}` : ''}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.buildings.map(building => {
                    const floors = [...new Set(building.rooms.map(room => room.floor))];
                    return (
                      <div key={building.id} className="rounded-xl border p-3">
                        <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" />{building.name}</div>
                        <div className="mt-3 space-y-2">
                          {floors.map(floor => {
                            const rooms = building.rooms.filter(room => room.floor === floor);
                            return <div key={floor} className="text-xs"><span className="font-semibold">{floor}:</span> <span className="text-muted-foreground">{rooms.map(room => `${room.room}${room.capacity !== null ? ` (${room.capacity})` : ''}`).join(', ')}</span></div>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!location.buildings.length && <p className="text-sm text-muted-foreground">Local criado. Importe a planilha para cadastrar prédios, andares e salas.</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>Novo local</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Nome do local *</Label><Input value={newName} onChange={event => setNewName(event.target.value)} placeholder="Ex.: FUMEC" /></div>
            <div className="space-y-1.5"><Label>Endereço</Label><Input value={newAddress} onChange={event => setNewAddress(event.target.value)} placeholder="Endereço completo" /></div>
            <p className="text-xs text-muted-foreground">Depois de criar o local, use a importação para cadastrar Prédio → Andar → Sala → Capacidade.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={!newName.trim() || createAndAttach.isPending} onClick={async () => { await createAndAttach.mutateAsync({ name: newName, address: newAddress }); setNewName(''); setNewAddress(''); setCreateOpen(false); }}>Salvar local</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>Conferir importação de locais</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{fileName}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[['Locais', previewStats.locations], ['Prédios', previewStats.buildings], ['Andares', previewStats.floors], ['Salas', previewStats.rooms]].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-3 text-center"><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
            </div>
            <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">
              {preview.slice(0, 30).map((row, index) => <div key={`${row.local}-${row.building}-${row.floor}-${row.room}-${index}`} className="p-3 text-sm"><p className="font-medium">{row.local} · {row.building} · {row.floor} · {row.room}</p><p className="text-xs text-muted-foreground">{row.address || 'Sem endereço'}{row.capacity !== null ? ` · Capacidade ${row.capacity}` : ' · Capacidade não informada'}</p></div>)}
              {preview.length > 30 && <p className="p-3 text-xs text-muted-foreground">+ {preview.length - 30} linhas não exibidas na amostra.</p>}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button><Button disabled={!preview.length || importRows.isPending} onClick={() => void confirmImport()}>{importRows.isPending ? 'Importando...' : `Importar ${preview.length} salas/ambientes`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
