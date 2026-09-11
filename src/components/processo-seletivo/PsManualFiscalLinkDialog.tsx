import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePsEventCollaboratorMutations } from '@/hooks/useProcessoSeletivo';
import { usePsEventLocationStructure } from '@/hooks/usePsEventLocations';
import { supabase } from '@/integrations/supabase/client';
import { buildManualEventCollaboratorRow } from '@/lib/psManualEventCollaboratorSnapshot.mjs';
import { preparePixPlan, persistPixPlan } from '@/lib/psPixPlan';
import { toast } from 'sonner';

type Props = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collaborators: any[];
  links: any[];
  roles: any[];
  rolePay: (roleValue?: string | null) => number;
};

export function PsManualFiscalLinkDialog({ eventId, open, onOpenChange, collaborators, links, roles, rolePay }: Props) {
  const queryClient = useQueryClient();
  const { add } = usePsEventCollaboratorMutations(eventId);
  const { data: locations = [], isLoading: locationsLoading } = usePsEventLocationStructure(eventId);
  const [searchFiscal, setSearchFiscal] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roleValue, setRoleValue] = useState('');
  const [locationId, setLocationId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState('');
  const [roomId, setRoomId] = useState('');
  const [pixOverrideById, setPixOverrideById] = useState<Record<string, string>>({});

  const location = locations.find(item => item.id === locationId);
  const building = location?.buildings.find(item => item.id === buildingId);
  const floors = useMemo(() => [...new Set((building?.rooms || []).map(room => room.floor))], [building]);
  const rooms = (building?.rooms || []).filter(room => room.floor === floor);
  const room = rooms.find(item => item.id === roomId);

  const visibleCollaborators = useMemo(() => {
    const query = searchFiscal.trim().toLowerCase();
    return collaborators
      .filter(collaborator => collaborator.active && !links.some(link => link.collaborator_id === collaborator.id))
      .filter(collaborator => !query || [collaborator.full_name, collaborator.email, collaborator.matricula, collaborator.institution, collaborator.unit, collaborator.role]
        .filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [collaborators, links, searchFiscal]);

  const reset = () => {
    setSearchFiscal('');
    setSelected([]);
    setRoleValue('');
    setLocationId('');
    setBuildingId('');
    setFloor('');
    setRoomId('');
    setPixOverrideById({});
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const linkFiscals = async () => {
    if (!selected.length || !roleValue || !location || !building || !room) return;
    const selectedCollaborators = selected.map(id => collaborators.find(item => item.id === id)).filter(Boolean) as any[];
    if (selectedCollaborators.length !== selected.length) {
      toast.error('Seleção de fiscais desatualizada. Selecione novamente.');
      return;
    }

    try {
      const pixPlan = preparePixPlan(selectedCollaborators, pixOverrideById);
      await persistPixPlan(pixPlan, async (collaboratorId, pix) => {
        const { data, error } = await supabase.from('ps_collaborators').update({ pix }).eq('id', collaboratorId).select('id').single();
        if (error || !data) throw new Error(error?.message || 'Não foi possível salvar o PIX.');
        void queryClient.invalidateQueries({ queryKey: ['ps_collaborators'] });
      });

      const role = roles.find(item => item.value === roleValue);
      const pixById = Object.fromEntries(pixPlan.map(item => [item.collaborator.id, item.pix]));
      const rows = selectedCollaborators.map(collaborator => buildManualEventCollaboratorRow({
        eventId,
        collaboratorId: collaborator.id,
        collaborator: { ...collaborator, pix: pixById[collaborator.id] },
        roleValue,
        roleName: role?.name,
        payValue: rolePay(roleValue),
        campus: location.name,
        locationAddress: location.address,
        building: building.name,
        floor: room.floor,
        room: room.room,
        locationId: location.id,
        buildingId: building.id,
        roomId: room.id,
      }));
      await add.mutateAsync(rows);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível vincular os fiscais.');
    }
  };

  const validLocation = !!location && !!building && !!room;
  const missingPix = selected.some(id => {
    const collaborator = collaborators.find(item => item.id === id);
    const storedPix = typeof collaborator?.pix === 'string' ? collaborator.pix : '';
    return !(pixOverrideById[id] ?? storedPix).trim();
  });

  return (
    <Dialog open={open} onOpenChange={value => value ? onOpenChange(true) : close()}>
      <DialogContent className="max-h-[88vh] overflow-x-hidden overflow-y-auto sm:max-w-2xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Vincular fiscais manualmente</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Função *</Label>
            <Select value={roleValue} onValueChange={setRoleValue}>
              <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
              <SelectContent>{roles.map(role => <SelectItem key={role.id} value={role.value}>{role.name} — R$ {Number(rolePay(role.value)).toFixed(2)}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <section className="space-y-3 rounded-2xl border bg-muted/10 p-4">
            <div>
              <p className="font-medium">Localização da atuação</p>
              <p className="text-xs text-muted-foreground">A seleção abaixo será utilizada na alocação, presença e comunicações do fiscal.</p>
            </div>
            {locationsLoading ? <p className="text-sm text-muted-foreground">Carregando locais...</p> : locations.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Nenhum local está vinculado a este evento. Cadastre ou importe a estrutura na aba Locais.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Local / Campus *</Label>
                  <Select value={locationId} onValueChange={value => { setLocationId(value); setBuildingId(''); setFloor(''); setRoomId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                    <SelectContent>{locations.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Prédio *</Label>
                  <Select value={buildingId} disabled={!locationId} onValueChange={value => { setBuildingId(value); setFloor(''); setRoomId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o prédio" /></SelectTrigger>
                    <SelectContent>{(location?.buildings || []).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Andar *</Label>
                  <Select value={floor} disabled={!buildingId} onValueChange={value => { setFloor(value); setRoomId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o andar" /></SelectTrigger>
                    <SelectContent>{floors.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sala / ambiente *</Label>
                  <Select value={roomId} disabled={!floor} onValueChange={setRoomId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
                    <SelectContent>{rooms.map(item => <SelectItem key={item.id} value={item.id}>{item.room}{item.capacity !== null ? ` — capacidade ${item.capacity}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {location?.address && <p className="text-xs text-muted-foreground"><strong>Endereço:</strong> {location.address}</p>}
          </section>

          <Input value={searchFiscal} onChange={event => setSearchFiscal(event.target.value)} placeholder="Buscar fiscal..." />
          <div className="max-h-72 space-y-2 overflow-y-auto overflow-x-hidden rounded-lg border p-2">
            {visibleCollaborators.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Nenhum fiscal encontrado.</p> : visibleCollaborators.map(collaborator => {
              const email = collaborator.email ? String(collaborator.email).trim() : '';
              const matricula = collaborator.matricula ? `Matrícula ${String(collaborator.matricula).trim()}` : '';
              const storedPix = typeof collaborator.pix === 'string' ? collaborator.pix : '';
              const resolvedPix = (pixOverrideById[collaborator.id] ?? storedPix).trim();
              return (
                <div key={collaborator.id} className="space-y-2 rounded-lg border bg-muted/10 p-2">
                  <Button type="button" variant={selected.includes(collaborator.id) ? 'default' : 'ghost'} className="h-auto min-h-0 w-full justify-start whitespace-normal px-3 py-2" onClick={() => setSelected(selected.includes(collaborator.id) ? selected.filter(id => id !== collaborator.id) : [...selected, collaborator.id])}>
                    <span className="flex min-w-0 flex-col items-start text-left"><span className="font-medium">{collaborator.full_name || 'Sem nome'}</span>{(email || matricula) && <span className="break-all text-xs text-muted-foreground">{[email, matricula].filter(Boolean).join(' · ')}</span>}</span>
                  </Button>
                  {selected.includes(collaborator.id) && <div className="space-y-1.5"><div className="flex items-center justify-between"><Label className="text-[10px] uppercase text-muted-foreground">PIX</Label><Badge variant={resolvedPix ? 'default' : 'secondary'} className="text-[10px]">{resolvedPix ? 'PIX cadastrado' : 'Sem PIX'}</Badge></div><Input value={resolvedPix} onChange={event => setPixOverrideById(current => ({ ...current, [collaborator.id]: event.target.value }))} placeholder="Informe PIX para vincular" className={resolvedPix ? '' : 'border-destructive/60'} /></div>}
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button onClick={() => void linkFiscals()} disabled={!selected.length || !roleValue || !validLocation || missingPix || add.isPending}>Vincular {selected.length || ''}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
