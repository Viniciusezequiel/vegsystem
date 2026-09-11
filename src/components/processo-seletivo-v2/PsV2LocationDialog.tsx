import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePsV2StructureMutations } from '@/hooks/useProcessoSeletivoV2';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; location?: any | null; onSaved?: (location: any) => void };
const empty = { name: '', address_line: '', neighborhood: '', city: '', state: '', postal_code: '', notes: '', active: true, source: 'manual' };

export function PsV2LocationDialog({ open, onOpenChange, location, onSaved }: Props) {
  const { saveLocation } = usePsV2StructureMutations();
  const [form, setForm] = useState<any>(empty);
  const [initial, setInitial] = useState<any>(empty);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = location ? {
      id: location.id, name: location.name || '', address_line: location.address_line || '', neighborhood: location.neighborhood || '', city: location.city || '', state: location.state || '', postal_code: location.postal_code || '', notes: location.notes || '', active: location.active !== false, source: location.source || 'manual',
    } : { ...empty };
    setForm(next); setInitial(next);
  }, [open, location]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initial), [form, initial]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const requestClose = () => dirty ? setConfirmClose(true) : onOpenChange(false);
  const patch = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!form.name.trim()) return;
    const saved = await saveLocation.mutateAsync({ ...form, name: form.name.trim(), state: form.state.trim().toUpperCase().slice(0, 2) || null });
    setInitial(saved); onSaved?.(saved); onOpenChange(false);
  };

  return <>
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : requestClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{location ? 'Editar local' : 'Novo local'}</DialogTitle><DialogDescription>Cadastre o endereço principal. Prédios, andares, áreas e ambientes serão organizados em seguida.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="v2-location-name">Nome do local *</Label><Input id="v2-location-name" value={form.name} onChange={e => patch('name', e.target.value)} placeholder="Ex.: Campus I" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="v2-address">Endereço</Label><Input id="v2-address" value={form.address_line} onChange={e => patch('address_line', e.target.value)} placeholder="Rua, número e complemento" /></div>
          <div className="space-y-1.5"><Label>Bairro</Label><Input value={form.neighborhood} onChange={e => patch('neighborhood', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>CEP</Label><Input value={form.postal_code} onChange={e => patch('postal_code', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.city} onChange={e => patch('city', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>UF</Label><Input value={form.state} maxLength={2} onChange={e => patch('state', e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={e => patch('notes', e.target.value)} placeholder="Acessos, referências ou informações operacionais." /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={requestClose}>Cancelar</Button><Button type="button" onClick={submit} disabled={!form.name.trim() || saveLocation.isPending}>{saveLocation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar local</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>Existem informações ainda não salvas neste formulário.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmClose(false); onOpenChange(false); }}>Descartar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
