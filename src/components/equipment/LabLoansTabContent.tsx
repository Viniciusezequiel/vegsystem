import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { cn } from '@/lib/utils';
import { auditUserName, useAuditUserNames } from '@/hooks/useAuditUserNames';
import { useAvailableLabLockers, useCreateLabLoan, useLabLoans, useReturnLabLoan, type LabLoan } from '@/hooks/useLabLoans';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Beaker, CheckCircle2, Clock3, KeyRound, Package, Plus, RotateCcw, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';

const activityLabels: Record<string, string> = {
  aula: 'Aula',
  monitoria: 'Monitoria',
  tcc: 'TCC',
  coleta: 'Coleta',
  iniciacao_cientifica: 'Iniciação científica',
  outra: 'Outra',
};

const shiftLabels: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

const freshForm = () => ({
  borrower_name: '',
  borrower_sector: '',
  borrower_phone: '',
  activity_type: 'aula',
  activity_other: '',
  shift: 'manha',
  locker_id: '',
  materials: '',
  usage_mode: 'lab_use',
  notes: '',
});

export function LabLoansTabContent({ searchQuery }: { searchQuery: string }) {
  const { data: loans = [], isLoading } = useLabLoans();
  const { data: lockers = [] } = useAvailableLabLockers();
  const createLoan = useCreateLabLoan();
  const returnLoan = useReturnLabLoan();

  const [view, setView] = useState<'active' | 'returned'>('active');
  const [createOpen, setCreateOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<LabLoan | null>(null);
  const [form, setForm] = useState(freshForm());
  const [borrowerSignature, setBorrowerSignature] = useState<string | null>(null);
  const [returnSignature, setReturnSignature] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [manualClose, setManualClose] = useState(false);
  const [manualReason, setManualReason] = useState('');

  const auditIds = useMemo(
    () => loans.flatMap((loan) => [loan.loaned_by, loan.returned_by]).filter(Boolean),
    [loans]
  );
  const { data: auditUsers = {} } = useAuditUserNames(auditIds);

  const counts = useMemo(() => ({
    active: loans.filter((loan) => loan.status === 'active').length,
    returned: loans.filter((loan) => loan.status === 'returned').length,
    keys: loans
      .filter((loan) => loan.status === 'active')
      .flatMap((loan) => loan.items || [])
      .filter((item) => item.item_type === 'locker' && item.active).length,
  }), [loans]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return loans.filter((loan) => {
      if (loan.status !== view) return false;
      if (!query) return true;
      const items = (loan.items || []).map((item) => [
        item.locker?.code,
        item.locker?.location,
        item.equipment?.name,
        item.manual_item_name,
      ].filter(Boolean).join(' ')).join(' ');
      return [
        loan.borrower_name,
        loan.borrower_sector,
        loan.borrower_phone,
        activityLabels[loan.activity_type],
        items,
        auditUserName(auditUsers, loan.loaned_by, ''),
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }, [loans, view, searchQuery, auditUsers]);

  const resetCreate = () => {
    setForm(freshForm());
    setBorrowerSignature(null);
  };

  const handleCreate = async () => {
    if (!form.borrower_name.trim() || !form.borrower_sector.trim()) {
      toast.error('Informe o responsável e o setor.');
      return;
    }
    if (!borrowerSignature) {
      toast.error('A assinatura de retirada é obrigatória.');
      return;
    }
    if (form.activity_type === 'outra' && !form.activity_other.trim()) {
      toast.error('Informe qual é a atividade.');
      return;
    }

    const items: Array<any> = [];
    if (form.locker_id) {
      items.push({ item_type: 'locker', locker_id: form.locker_id, quantity: 1, usage_mode: 'removal' });
    }
    for (const line of form.materials.split('\n').map((value) => value.trim()).filter(Boolean)) {
      items.push({ item_type: 'manual', manual_item_name: line, quantity: 1, usage_mode: form.usage_mode });
    }
    if (!items.length) {
      toast.error('Informe ao menos uma chave/armário ou material.');
      return;
    }

    await createLoan.mutateAsync({
      borrower_name: form.borrower_name,
      borrower_sector: form.borrower_sector,
      borrower_phone: form.borrower_phone,
      activity_type: form.activity_type,
      activity_other: form.activity_other,
      shift: form.shift,
      borrower_signature: borrowerSignature,
      notes: form.notes,
      items,
    });
    setCreateOpen(false);
    resetCreate();
    setView('active');
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    if (!manualClose && !returnSignature) {
      toast.error('Colete a assinatura de devolução ou use a intervenção manual.');
      return;
    }
    if (manualClose && manualReason.trim().length < 3) {
      toast.error('Informe a justificativa da intervenção manual.');
      return;
    }

    await returnLoan.mutateAsync({
      id: returnTarget.id,
      return_signature: manualClose ? null : returnSignature,
      notes: returnNotes,
      manual_reason: manualClose ? manualReason : undefined,
    });
    setReturnTarget(null);
    setReturnSignature(null);
    setReturnNotes('');
    setManualClose(false);
    setManualReason('');
  };

  const formatDateTime = (value: string) => format(parseISO(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  if (isLoading) {
    return <div className="rounded-2xl border border-border/40 bg-card/40 p-10 text-center text-sm text-muted-foreground">Carregando chaves e laboratórios...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => setView('active')} className="text-left">
          <div className={cn('rounded-xl border p-3 transition', view === 'active' ? 'border-primary/35 bg-primary/[0.08]' : 'border-border/40 bg-card/40 hover:border-primary/20')}>
            <p className="text-[10px] text-muted-foreground">Em uso agora</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums">{counts.active}</p>
          </div>
        </button>
        <div className="rounded-xl border border-border/40 bg-card/40 p-3">
          <p className="text-[10px] text-muted-foreground">Chaves em uso</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-400">{counts.keys}</p>
        </div>
        <button type="button" onClick={() => setView('returned')} className="text-left">
          <div className={cn('rounded-xl border p-3 transition', view === 'returned' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-border/40 bg-card/40 hover:border-emerald-500/20')}>
            <p className="text-[10px] text-muted-foreground">Devolvidos</p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-400">{counts.returned}</p>
          </div>
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Chaves e Laboratórios</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Substitui a ficha em papel e registra automaticamente quem entregou e recebeu a devolução.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-9 shrink-0"><Plus className="mr-2 h-4 w-4" /> Novo registro</Button>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 px-5 py-12 text-center">
          <KeyRound className="mx-auto h-9 w-9 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhum registro encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">Os empréstimos de chaves e materiais do laboratório aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((loan) => {
            const lockerItems = (loan.items || []).filter((item) => item.item_type === 'locker');
            const materialItems = (loan.items || []).filter((item) => item.item_type !== 'locker');
            return (
              <article key={loan.id} className="rounded-2xl border border-border/40 bg-card/50 p-3">
                <div className="grid gap-3 xl:grid-cols-[1.2fr_.8fr_.8fr_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', loan.status === 'active' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>
                      {lockerItems.length ? <KeyRound className="h-5 w-5" /> : <Beaker className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{loan.borrower_name}</p>
                        <Badge variant="outline" className="rounded-full text-[9px]">{shiftLabels[loan.shift]}</Badge>
                        <Badge variant={loan.status === 'active' ? 'default' : 'secondary'} className="rounded-full text-[9px]">{loan.status === 'active' ? 'Em uso' : 'Devolvido'}</Badge>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">{loan.borrower_sector} · {activityLabels[loan.activity_type]}{loan.activity_type === 'outra' && loan.activity_other ? `: ${loan.activity_other}` : ''}</p>
                    </div>
                  </div>

                  <div className="text-xs">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Chave / armário</p>
                    <p className="mt-1 font-medium">{lockerItems.length ? lockerItems.map((item) => item.locker?.code || 'Armário').join(', ') : 'Sem chave'}</p>
                    {lockerItems[0]?.locker?.location && <p className="mt-0.5 text-[10px] text-muted-foreground">{lockerItems[0].locker.location}</p>}
                  </div>

                  <div className="text-xs">
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Materiais</p>
                    <p className="mt-1 line-clamp-2 font-medium">{materialItems.length ? materialItems.map((item) => item.equipment?.name || item.manual_item_name).filter(Boolean).join(', ') : 'Nenhum material'}</p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {loan.status === 'active' && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setReturnTarget(loan)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Devolver</Button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/30 pt-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1"><UserRoundCheck className="h-3 w-3" /> Registrado por <strong className="text-foreground">{auditUserName(auditUsers, loan.loaned_by)}</strong></span>
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatDateTime(loan.created_at)}</span>
                  {loan.returned_at && <span>Devolução: {formatDateTime(loan.returned_at)}</span>}
                  {loan.returned_by && <span>Recebida por <strong className="text-foreground">{auditUserName(auditUsers, loan.returned_by)}</strong></span>}
                  {loan.manual_close_reason && <span className="text-amber-400">Intervenção manual: {loan.manual_close_reason}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreate(); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Novo empréstimo — Chaves e Laboratórios</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Responsável *</Label><Input value={form.borrower_name} onChange={(e) => setForm({ ...form, borrower_name: e.target.value })} placeholder="Nome completo" /></div>
              <div className="space-y-1.5"><Label>Setor / curso *</Label><Input value={form.borrower_sector} onChange={(e) => setForm({ ...form, borrower_sector: e.target.value })} placeholder="Setor ou curso" /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.borrower_phone} onChange={(e) => setForm({ ...form, borrower_phone: e.target.value })} placeholder="(31) 00000-0000" /></div>
              <div className="space-y-1.5"><Label>Turno *</Label><Select value={form.shift} onValueChange={(value) => setForm({ ...form, shift: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="noite">Noite</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Atividade *</Label><Select value={form.activity_type} onValueChange={(value) => setForm({ ...form, activity_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aula">Aula</SelectItem><SelectItem value="monitoria">Monitoria</SelectItem><SelectItem value="tcc">TCC</SelectItem><SelectItem value="coleta">Coleta</SelectItem><SelectItem value="iniciacao_cientifica">Iniciação científica</SelectItem><SelectItem value="outra">Outra</SelectItem></SelectContent></Select></div>
              {form.activity_type === 'outra' && <div className="space-y-1.5"><Label>Qual atividade? *</Label><Input value={form.activity_other} onChange={(e) => setForm({ ...form, activity_other: e.target.value })} /></div>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Chave / armário</Label>
                <Select value={form.locker_id || 'none'} onValueChange={(value) => setForm({ ...form, locker_id: value === 'none' ? '' : value })}>
                  <SelectTrigger><SelectValue placeholder="Sem chave" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem chave / armário</SelectItem>{lockers.map((locker: any) => <SelectItem key={locker.id} value={locker.id}>{locker.code} · {locker.location}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Chaves já em uso ficam indisponíveis automaticamente.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de uso dos materiais</Label>
                <Select value={form.usage_mode} onValueChange={(value) => setForm({ ...form, usage_mode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lab_use">Utilização no laboratório</SelectItem><SelectItem value="removal">Retirada do laboratório</SelectItem></SelectContent></Select>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Materiais</Label><Textarea rows={4} value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder={'Digite um material por linha\nEx.: Dinamômetro\nFita antropométrica'} /><p className="text-[10px] text-muted-foreground">Cada linha será registrada como um item do mesmo empréstimo.</p></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="space-y-1.5"><Label>Assinatura da retirada *</Label><SignaturePad onSignatureChange={setBorrowerSignature} height={150} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreate()} disabled={createLoan.isPending}>{createLoan.isPending ? 'Registrando...' : 'Registrar empréstimo'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!returnTarget} onOpenChange={(open) => { if (!open) { setReturnTarget(null); setReturnSignature(null); setReturnNotes(''); setManualClose(false); setManualReason(''); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><p className="font-semibold">{returnTarget?.borrower_name}</p><p className="mt-1 text-xs text-muted-foreground">{returnTarget?.items?.map((item) => item.locker?.code || item.equipment?.name || item.manual_item_name).filter(Boolean).join(' · ')}</p></div>
            {!manualClose ? <div className="space-y-1.5"><Label>Assinatura da devolução *</Label><SignaturePad onSignatureChange={setReturnSignature} height={150} /></div> : <div className="space-y-1.5"><Label>Justificativa da intervenção manual *</Label><Textarea rows={3} value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Ex.: devolução recebida sem presença do responsável; conferida pela equipe." /></div>}
            <div className="space-y-1.5"><Label>Observações da devolução</Label><Textarea rows={2} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} /></div>
            <Button type="button" variant="ghost" size="sm" className={cn('text-xs', manualClose && 'text-amber-400')} onClick={() => { setManualClose((value) => !value); setReturnSignature(null); }}>{manualClose ? 'Voltar para assinatura normal' : 'Intervenção manual: encerrar sem assinatura'}</Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReturnTarget(null)}>Cancelar</Button><Button onClick={() => void handleReturn()} disabled={returnLoan.isPending}>{returnLoan.isPending ? 'Salvando...' : 'Confirmar devolução'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
