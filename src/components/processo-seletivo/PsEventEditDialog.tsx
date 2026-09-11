import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsEventMutations } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

type Props = {
  event: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PsEventEditDialog({ event, open, onOpenChange }: Props) {
  const { save } = usePsEventMutations();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (open && event) setForm({ ...event });
  }, [open, event]);

  const submit = async () => {
    if (!form?.id || !form.name?.trim() || !form.date) return;
    const payload = {
      ...form,
      name: form.name.trim(),
      coordinator_name: form.coordinator_name?.trim() || null,
      description: form.description?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    await save.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={value => !save.isPending && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>Editar evento</DialogTitle></DialogHeader>
        {form && <div className="space-y-4">
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name || ''} onChange={event => setForm({ ...form, name: event.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={form.date || ''} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label><Select value={form.status || 'planejamento'} onValueChange={value => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PS_EVENT_STATUS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-1.5"><Label>Coordenador</Label><Input value={form.coordinator_name || ''} onChange={event => setForm({ ...form, coordinator_name: event.target.value })} /></div>
          <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground"><strong>Local do evento:</strong> {form.location || 'não definido'}. Os locais, endereços, prédios, andares e salas são gerenciados pela aba <strong>Locais</strong> do evento.</div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={3} value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
          <div className="space-y-1.5"><Label>Observações internas</Label><Textarea rows={3} value={form.notes || ''} onChange={event => setForm({ ...form, notes: event.target.value })} /></div>
        </div>}
        <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={save.isPending || !form?.name?.trim() || !form?.date} onClick={() => void submit()}>{save.isPending ? 'Salvando...' : 'Salvar alterações'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
