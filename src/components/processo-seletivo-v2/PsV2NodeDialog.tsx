import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsV2StructureMutations } from '@/hooks/useProcessoSeletivoV2';

type Kind = 'building' | 'floor' | 'area' | 'environment';
type Props = { open: boolean; onOpenChange: (open: boolean) => void; kind: Kind; parentId: string; row?: any | null; floorAreas?: any[] };
const labels: Record<Kind, string> = { building: 'prédio', floor: 'andar', area: 'área', environment: 'ambiente' };
const tables: Record<Kind, string> = { building: 'ps_v2_buildings', floor: 'ps_v2_floors', area: 'ps_v2_areas', environment: 'ps_v2_environments' };

export function PsV2NodeDialog({ open, onOpenChange, kind, parentId, row, floorAreas = [] }: Props) {
  const { saveNode } = usePsV2StructureMutations();
  const [form, setForm] = useState<any>({});
  const [initial, setInitial] = useState<any>({});
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = {
      id: row?.id,
      name: row?.name || '',
      code: row?.code || '',
      notes: row?.notes || '',
      area_type: row?.area_type || 'other',
      environment_type: row?.environment_type || 'classroom',
      area_id: row?.area_id || 'none',
      capacity: row?.capacity ?? '',
      active: row?.active !== false,
    };
    setForm(next); setInitial(next);
  }, [open, row, kind]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const requestClose = () => dirty ? setConfirmClose(true) : onOpenChange(false);

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload: any = { id: form.id, name: form.name.trim(), notes: form.notes || null, active: form.active };
    if (kind === 'building') { payload.location_id = parentId; payload.code = form.code || null; }
    if (kind === 'floor') { payload.building_id = parentId; payload.code = form.code || null; }
    if (kind === 'area') { payload.floor_id = parentId; payload.area_type = form.area_type; }
    if (kind === 'environment') {
      payload.floor_id = parentId; payload.code = form.code || null; payload.area_id = form.area_id === 'none' ? null : form.area_id;
      payload.environment_type = form.environment_type; payload.capacity = form.capacity === '' ? null : Math.max(0, Number(form.capacity) || 0);
    }
    await saveNode.mutateAsync({ table: tables[kind], payload });
    setInitial(form); onOpenChange(false);
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : requestClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{row ? 'Editar' : 'Novo'} {labels[kind]}</DialogTitle><DialogDescription>Salve este nível antes de seguir para os itens abaixo dele.</DialogDescription></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name || ''} onChange={e => patch('name', e.target.value)} placeholder={kind === 'building' ? 'Prédio principal' : kind === 'floor' ? '1º andar' : kind === 'area' ? 'Corredor principal' : 'Sala 101'} /></div>
          {(kind === 'building' || kind === 'floor' || kind === 'environment') && <div className="space-y-1.5"><Label>Código</Label><Input value={form.code || ''} onChange={e => patch('code', e.target.value)} placeholder="Opcional" /></div>}
          {kind === 'area' && <div className="space-y-1.5"><Label>Tipo de área</Label><Select value={form.area_type} onValueChange={value => patch('area_type', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="corridor">Corredor</SelectItem><SelectItem value="sanitary">Área sanitária</SelectItem><SelectItem value="entrance">Entrada / acesso</SelectItem><SelectItem value="coordination">Coordenação</SelectItem><SelectItem value="support">Apoio</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div>}
          {kind === 'environment' && <>
            <div className="space-y-1.5"><Label>Tipo de ambiente</Label><Select value={form.environment_type} onValueChange={value => patch('environment_type', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="classroom">Sala / aplicação</SelectItem><SelectItem value="bathroom">Banheiro</SelectItem><SelectItem value="coordination">Coordenação</SelectItem><SelectItem value="support">Apoio</SelectItem><SelectItem value="entrance">Entrada / acesso</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent></Select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Área vinculada</Label><Select value={form.area_id} onValueChange={value => patch('area_id', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem área específica</SelectItem>{floorAreas.map(area => <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Capacidade</Label><Input type="number" min={0} value={form.capacity} onChange={e => patch('capacity', e.target.value)} /></div></div>
          </>}
          <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes || ''} onChange={e => patch('notes', e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={requestClose}>Cancelar</Button><Button onClick={submit} disabled={!form.name?.trim() || saveNode.isPending}>{saveNode.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>Este item possui alterações que ainda não foram salvas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmClose(false); onOpenChange(false); }}>Descartar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
