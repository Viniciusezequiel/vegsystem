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
import { useEquipmentList } from '@/hooks/useEquipment';
import { useCreateLabLoan, useLabLoans, useReturnLabLoan, type LabLoan } from '@/hooks/useLabLoans';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Beaker,
  Clock3,
  Database,
  History,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRoundCheck,
} from 'lucide-react';
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

type MaterialUsageMode = 'lab_use' | 'removal';
type MaterialSource = 'manual' | 'equipment';

type MaterialDraft = {
  localId: string;
  source: MaterialSource;
  name: string;
  equipmentId?: string;
  patrimonyCode?: string | null;
  quantity: number;
  usageMode: MaterialUsageMode;
};

const freshForm = () => ({
  borrower_name: '',
  borrower_sector: '',
  borrower_phone: '',
  activity_type: 'aula',
  activity_other: '',
  shift: 'manha',
  notes: '',
});

const newDraftId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function RegisteredEquipmentPicker({
  quantity,
  usageMode,
  onAdd,
}: {
  quantity: number;
  usageMode: MaterialUsageMode;
  onAdd: (draft: MaterialDraft) => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim();
  const { data: equipment = [], isLoading } = useEquipmentList(query.length >= 2 ? query : '__lab_picker_idle__');

  const results = useMemo(
    () => (query.length >= 2 ? equipment.filter((item: any) => item.status !== 'maintenance').slice(0, 8) : []),
    [equipment, query]
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou patrimônio..."
          className="pl-9"
        />
      </div>
      <p className="text-[10px] text-muted-foreground">Digite pelo menos 2 caracteres. O vínculo com o cadastro é opcional.</p>

      {query.length >= 2 && (
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border/45 bg-background/20 p-1.5">
          {isLoading ? (
            <p className="px-2 py-5 text-center text-xs text-muted-foreground">Buscando equipamentos...</p>
          ) : !results.length ? (
            <p className="px-2 py-5 text-center text-xs text-muted-foreground">Nenhum equipamento cadastrado encontrado.</p>
          ) : (
            results.map((item: any) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-primary/[0.07]"
                onClick={() => {
                  onAdd({
                    localId: newDraftId(),
                    source: 'equipment',
                    name: item.name,
                    equipmentId: item.id,
                    patrimonyCode: item.patrimony_code || null,
                    quantity,
                    usageMode,
                  });
                  setSearch('');
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{item.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {item.patrimony_code ? `Patrimônio ${item.patrimony_code}` : 'Sem patrimônio informado'}
                  </span>
                </span>
                <Plus className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function LabLoansTabContent({ searchQuery }: { searchQuery: string }) {
  const { data: loans = [], isLoading } = useLabLoans();
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

  const [materialSource, setMaterialSource] = useState<MaterialSource>('manual');
  const [materialName, setMaterialName] = useState('');
  const [materialQuantity, setMaterialQuantity] = useState(1);
  const [materialUsageMode, setMaterialUsageMode] = useState<MaterialUsageMode>('lab_use');
  const [materialDrafts, setMaterialDrafts] = useState<MaterialDraft[]>([]);

  const auditIds = useMemo(
    () => loans.flatMap((loan) => [loan.loaned_by, loan.returned_by]).filter(Boolean),
    [loans]
  );
  const { data: auditUsers = {} } = useAuditUserNames(auditIds);

  const materialLoans = useMemo(
    () => loans.filter((loan) => (loan.items || []).some((item) => item.item_type !== 'locker')),
    [loans]
  );

  const materialHistory = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const loan of materialLoans) {
      for (const item of loan.items || []) {
        const name = String(item.manual_item_name || '').trim();
        if (item.item_type !== 'manual' || !name) continue;
        const key = name.toLocaleLowerCase('pt-BR');
        const current = map.get(key);
        map.set(key, { name: current?.name || name, count: (current?.count || 0) + 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  }, [materialLoans]);

  const materialSuggestions = useMemo(() => {
    const query = materialName.trim().toLocaleLowerCase('pt-BR');
    return materialHistory
      .filter((item) => !query || item.name.toLocaleLowerCase('pt-BR').includes(query))
      .slice(0, 6);
  }, [materialHistory, materialName]);

  const counts = useMemo(() => ({
    active: materialLoans.filter((loan) => loan.status === 'active').length,
    returned: materialLoans.filter((loan) => loan.status === 'returned').length,
    materials: materialLoans
      .filter((loan) => loan.status === 'active')
      .flatMap((loan) => loan.items || [])
      .filter((item) => item.item_type !== 'locker' && item.active)
      .reduce((total, item) => total + Math.max(1, Number(item.quantity || 1)), 0),
  }), [materialLoans]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return materialLoans.filter((loan) => {
      if (loan.status !== view) return false;
      if (!query) return true;
      const items = (loan.items || [])
        .filter((item) => item.item_type !== 'locker')
        .map((item) => [item.equipment?.name, item.manual_item_name].filter(Boolean).join(' '))
        .join(' ');
      return [
        loan.borrower_name,
        loan.borrower_sector,
        loan.borrower_phone,
        activityLabels[loan.activity_type],
        items,
        auditUserName(auditUsers, loan.loaned_by, ''),
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }, [materialLoans, view, searchQuery, auditUsers]);

  const resetCreate = () => {
    setForm(freshForm());
    setBorrowerSignature(null);
    setMaterialSource('manual');
    setMaterialName('');
    setMaterialQuantity(1);
    setMaterialUsageMode('lab_use');
    setMaterialDrafts([]);
  };

  const addManualMaterial = (suggestedName?: string) => {
    const name = String(suggestedName || materialName).trim();
    if (!name) {
      toast.error('Digite o nome do material.');
      return;
    }
    setMaterialDrafts((current) => [
      ...current,
      {
        localId: newDraftId(),
        source: 'manual',
        name,
        quantity: Math.max(1, Number(materialQuantity) || 1),
        usageMode: materialUsageMode,
      },
    ]);
    setMaterialName('');
    setMaterialQuantity(1);
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
    if (!materialDrafts.length) {
      toast.error('Informe ao menos um material.');
      return;
    }

    const items = materialDrafts.map((draft) => {
      if (draft.source === 'equipment' && draft.equipmentId) {
        return {
          item_type: 'equipment',
          equipment_id: draft.equipmentId,
          quantity: draft.quantity,
          usage_mode: draft.usageMode,
        };
      }
      return {
        item_type: 'manual',
        manual_item_name: draft.name,
        quantity: draft.quantity,
        usage_mode: draft.usageMode,
      };
    });

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
    return <div className="rounded-2xl border border-border/40 bg-card/40 p-10 text-center text-sm text-muted-foreground">Carregando empréstimos de laboratório...</div>;
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
          <p className="text-[10px] text-muted-foreground">Materiais em uso</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-400">{counts.materials}</p>
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
          <p className="text-sm font-semibold">Laboratórios</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Controle os materiais utilizados ou retirados dos laboratórios com registro de responsável e devolução.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-9 shrink-0"><Plus className="mr-2 h-4 w-4" /> Novo registro</Button>
      </div>

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 px-5 py-12 text-center">
          <Beaker className="mx-auto h-9 w-9 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Nenhum registro encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">Os empréstimos de materiais do laboratório aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((loan) => {
            const materialItems = (loan.items || []).filter((item) => item.item_type !== 'locker');
            return (
              <article key={loan.id} className="rounded-2xl border border-border/40 bg-card/50 p-3">
                <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', loan.status === 'active' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300')}>
                      <Beaker className="h-5 w-5" />
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
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Materiais</p>
                    <p className="mt-1 line-clamp-2 font-medium">
                      {materialItems.length
                        ? materialItems.map((item) => {
                            const name = item.equipment?.name || item.manual_item_name || 'Material';
                            return `${name}${Number(item.quantity || 1) > 1 ? ` ×${item.quantity}` : ''}`;
                          }).join(', ')
                        : 'Nenhum material'}
                    </p>
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
          <DialogHeader><DialogTitle>Novo empréstimo — Laboratórios</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Responsável *</Label><Input value={form.borrower_name} onChange={(e) => setForm({ ...form, borrower_name: e.target.value })} placeholder="Nome completo" /></div>
              <div className="space-y-1.5"><Label>Setor / curso *</Label><Input value={form.borrower_sector} onChange={(e) => setForm({ ...form, borrower_sector: e.target.value })} placeholder="Setor ou curso" /></div>
              <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.borrower_phone} onChange={(e) => setForm({ ...form, borrower_phone: e.target.value })} placeholder="(31) 00000-0000" /></div>
              <div className="space-y-1.5"><Label>Turno *</Label><Select value={form.shift} onValueChange={(value) => setForm({ ...form, shift: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manha">Manhã</SelectItem><SelectItem value="tarde">Tarde</SelectItem><SelectItem value="noite">Noite</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Atividade *</Label><Select value={form.activity_type} onValueChange={(value) => setForm({ ...form, activity_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aula">Aula</SelectItem><SelectItem value="monitoria">Monitoria</SelectItem><SelectItem value="tcc">TCC</SelectItem><SelectItem value="coleta">Coleta</SelectItem><SelectItem value="iniciacao_cientifica">Iniciação científica</SelectItem><SelectItem value="outra">Outra</SelectItem></SelectContent></Select></div>
              {form.activity_type === 'outra' && <div className="space-y-1.5"><Label>Qual atividade? *</Label><Input value={form.activity_other} onChange={(e) => setForm({ ...form, activity_other: e.target.value })} /></div>}
            </div>

            <div className="rounded-2xl border border-border/45 bg-muted/[0.025] p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Materiais</Label>
                  <p className="mt-1 text-[10px] text-muted-foreground">O material livre é o padrão. Vincular a um equipamento cadastrado é opcional.</p>
                </div>
                <div className="flex rounded-lg border border-border/45 bg-background/30 p-1">
                  <button
                    type="button"
                    className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-[10px] font-medium transition', materialSource === 'manual' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setMaterialSource('manual')}
                  >
                    <Beaker className="h-3.5 w-3.5" /> Material livre
                  </button>
                  <button
                    type="button"
                    className={cn('flex h-8 items-center gap-1.5 rounded-md px-3 text-[10px] font-medium transition', materialSource === 'equipment' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground')}
                    onClick={() => setMaterialSource('equipment')}
                  >
                    <Database className="h-3.5 w-3.5" /> Buscar cadastrado
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_190px]">
                {materialSource === 'manual' ? (
                  <div className="space-y-1.5">
                    <Input
                      value={materialName}
                      onChange={(event) => setMaterialName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addManualMaterial();
                        }
                      }}
                      placeholder="Ex.: Dinamômetro"
                    />
                    {!!materialSuggestions.length && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><History className="h-3 w-3" /> Sugestões:</span>
                        {materialSuggestions.map((item) => (
                          <button
                            key={item.name.toLocaleLowerCase('pt-BR')}
                            type="button"
                            className="rounded-full border border-border/50 bg-background/25 px-2 py-0.5 text-[9px] text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                            onClick={() => setMaterialName(item.name)}
                            title={`Usado ${item.count} vez(es) anteriormente`}
                          >
                            {item.name}{item.count > 1 ? ` · ${item.count}×` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <RegisteredEquipmentPicker
                    quantity={materialQuantity}
                    usageMode={materialUsageMode}
                    onAdd={(draft) => setMaterialDrafts((current) => [...current, draft])}
                  />
                )}

                <div className="space-y-1.5">
                  <Input
                    type="number"
                    min={1}
                    value={materialQuantity}
                    onChange={(event) => setMaterialQuantity(Math.max(1, Number(event.target.value) || 1))}
                    aria-label="Quantidade do material"
                  />
                  <p className="text-[9px] text-muted-foreground">Quantidade</p>
                </div>

                <div className="space-y-1.5">
                  <Select value={materialUsageMode} onValueChange={(value: MaterialUsageMode) => setMaterialUsageMode(value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lab_use">Uso no laboratório</SelectItem>
                      <SelectItem value="removal">Retirada do laboratório</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] text-muted-foreground">Forma de utilização</p>
                </div>
              </div>

              {materialSource === 'manual' && (
                <Button type="button" size="sm" variant="outline" className="mt-2 h-8" onClick={() => addManualMaterial()}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar material
                </Button>
              )}

              {!!materialDrafts.length && (
                <div className="mt-3 space-y-1.5 border-t border-border/35 pt-3">
                  {materialDrafts.map((draft) => (
                    <div key={draft.localId} className="flex items-center gap-2 rounded-xl border border-border/35 bg-background/20 px-3 py-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                        {draft.source === 'equipment' ? <Database className="h-4 w-4" /> : <Beaker className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-medium">{draft.name}</p>
                          <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[8px]">{draft.source === 'equipment' ? 'Cadastrado' : 'Livre'}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                          {draft.patrimonyCode ? `Patrimônio ${draft.patrimonyCode} · ` : ''}Qtd. {draft.quantity} · {draft.usageMode === 'lab_use' ? 'Uso no laboratório' : 'Retirada'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setMaterialDrafts((current) => current.filter((item) => item.localId !== draft.localId))}
                        title="Remover material"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><p className="font-semibold">{returnTarget?.borrower_name}</p><p className="mt-1 text-xs text-muted-foreground">{returnTarget?.items?.filter((item) => item.item_type !== 'locker').map((item) => item.equipment?.name || item.manual_item_name).filter(Boolean).join(' · ')}</p></div>
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
