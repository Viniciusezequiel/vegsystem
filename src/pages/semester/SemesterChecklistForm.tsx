import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  useReleasedCompetencies,
  useCompetencies,
  useSemesterChecklist,
  useCreateChecklist,
  useUpdateChecklist,
  useChecklistItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useFurnitureDetails,
  useCreateFurniture,
  useDeleteFurniture,
  useItemOptions,
  type SemesterItem,
} from '@/hooks/useSemesterChecklist';
import {
  SEMESTER_CATEGORIES,
  SEMESTER_BASE_ITEMS,
  FURNITURE_ITEM_TYPES,
  FURNITURE_PROBLEMS,
  FURNITURE_TYPES_CATEGORY,
  FURNITURE_PROBLEMS_CATEGORY,
  MAINTENANCE_TYPES,
  SEMESTER_ITEM_STATUS,
  statusColor,
  statusLabel,
  type SemesterCategory,
} from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Armchair, Save, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { MainLayout } from '@/components/layout/MainLayout';

function useRooms() {
  return useQuery({
    queryKey: ['reservation_rooms_simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservation_rooms')
        .select('id,name,code,campus,location')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export default function SemesterChecklistForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();

  const { data: released = [] } = useReleasedCompetencies();
  const { data: allComps = [] } = useCompetencies();
  const { data: existing } = useSemesterChecklist(id);
  const { data: rooms = [] } = useRooms();
  const create = useCreateChecklist();
  const update = useUpdateChecklist();

  const [competencyId, setCompetencyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [responsible, setResponsible] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [observation, setObservation] = useState('');

  useEffect(() => {
    if (existing) {
      setCompetencyId(existing.competency_id);
      setRoomId(existing.room_id ?? '');
      setResponsible(existing.responsible_name);
      setDate(existing.checklist_date);
      setObservation(existing.general_observation ?? '');
    } else {
      if (profile?.full_name && !responsible) setResponsible(profile.full_name);
      if (released[0] && !competencyId) setCompetencyId(released[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, profile, released]);

  const competenciesAvailable = isAdmin ? allComps : released;

  const room = rooms.find((r) => r.id === roomId);

  const saveHeader = async () => {
    if (!competencyId) return toast.error('Selecione uma competência');
    if (!roomId && !existing) return toast.error('Selecione uma sala');
    if (!responsible.trim()) return toast.error('Informe o responsável');
    const payload = {
      competency_id: competencyId,
      room_id: roomId || existing?.room_id || null,
      room_name: room?.name ?? existing?.room_name ?? '',
      room_code: room?.code ?? existing?.room_code ?? null,
      campus: room?.campus ?? existing?.campus ?? null,
      responsible_id: profile?.id ?? null,
      responsible_name: responsible.trim(),
      checklist_date: date,
      general_observation: observation || null,
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(payload as any);
        toast.success('Levantamento criado');
        navigate(`/semester/${created.id}`, { replace: true });
      } else if (id) {
        await update.mutateAsync({ id, patch: payload as any });
        toast.success('Levantamento atualizado');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!isNew && !existing) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  const releasedSelected = competenciesAvailable.find((c) => c.id === competencyId);
  const canEditItems = isAdmin || (releasedSelected?.status === 'released');

  return (
    <MainLayout>
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/semester')}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
        <Button onClick={saveHeader} disabled={create.isPending || update.isPending}>
          <Save className="h-4 w-4 mr-1" /> {isNew ? 'Criar levantamento' : 'Salvar cabeçalho'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do levantamento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Competência *</Label>
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {competenciesAvailable.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {competenciesAvailable.length === 0 && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Nenhuma competência liberada no momento.
              </p>
            )}
          </div>
          <div>
            <Label>Sala *</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={!isNew}>
              <SelectTrigger><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
              <SelectContent>
                {rooms.map((r: any) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} {r.code ? `(${r.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing && !isNew && (
              <p className="text-xs text-muted-foreground mt-1">{existing.room_name} — {existing.campus}</p>
            )}
          </div>
          <div>
            <Label>Responsável *</Label>
            <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {!isNew && existing && (
        <ItemsSection checklist={existing} canEdit={canEditItems} />
      )}

      {/* Observação geral — sempre por último */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observação geral</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            rows={3}
            placeholder="Anotações gerais sobre este levantamento"
          />
        </CardContent>
      </Card>
    </div>
    </MainLayout>
  );
}

function ItemsSection({ checklist, canEdit }: { checklist: any; canEdit: boolean }) {
  const checklistId = checklist.id;
  const { data: items = [], isLoading } = useChecklistItems(checklistId);
  const updateChecklist = useUpdateChecklist();
  const confirmed: string[] = checklist.confirmed_categories ?? [];

  const grouped = useMemo(() => {
    const g: Record<string, SemesterItem[]> = {};
    for (const c of SEMESTER_CATEGORIES) g[c] = [];
    items.forEach((i) => {
      g[i.category] = g[i.category] || [];
      g[i.category].push(i);
    });
    return g;
  }, [items]);

  const isDone = (cat: string) => grouped[cat].length > 0 || confirmed.includes(cat);
  const doneCount = SEMESTER_CATEGORIES.filter(isDone).length;
  const progress = Math.round((doneCount / SEMESTER_CATEGORIES.length) * 100);

  const toggleConfirm = async (cat: string, value: boolean) => {
    const next = value
      ? Array.from(new Set([...confirmed, cat]))
      : confirmed.filter((c) => c !== cat);
    try {
      await updateChecklist.mutateAsync({ id: checklistId, patch: { confirmed_categories: next } as any });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Itens por categoria</span>
          <span className="text-sm font-normal text-muted-foreground">{doneCount}/{SEMESTER_CATEGORIES.length} categorias revisadas ({progress}%)</span>
        </CardTitle>
        <Progress value={progress} className="h-2 mt-2" />
        <p className="text-xs text-muted-foreground mt-1">
          Entre em cada categoria e adicione itens ou marque como "em conformidade" para concluir o levantamento.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {SEMESTER_CATEGORIES.map((cat) => {
            const done = isDone(cat);
            const isConfirmed = confirmed.includes(cat);
            const hasItems = grouped[cat].length > 0;
            return (
              <AccordionItem key={cat} value={cat}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    {cat}
                    {hasItems && <Badge variant="secondary">{grouped[cat].length}</Badge>}
                    {isConfirmed && !hasItems && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        Em conformidade
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {canEdit && !hasItems && (
                    <div className="flex items-center justify-between gap-3 mb-3 p-3 rounded-md border bg-muted/30">
                      <div className="text-sm">
                        {isConfirmed
                          ? 'Categoria marcada como em conformidade (nada a incluir).'
                          : 'Sem itens. Se nada precisa ser registrado, marque como em conformidade.'}
                      </div>
                      <Button
                        size="sm"
                        variant={isConfirmed ? 'outline' : 'default'}
                        onClick={() => toggleConfirm(cat, !isConfirmed)}
                        disabled={updateChecklist.isPending}
                      >
                        {isConfirmed ? 'Desmarcar' : 'Marcar como em conformidade'}
                      </Button>
                    </div>
                  )}
                  <CategoryEditor
                    checklistId={checklistId}
                    category={cat}
                    items={grouped[cat]}
                    canEdit={canEdit}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        {isLoading && <div className="text-sm text-muted-foreground mt-3">Carregando...</div>}
      </CardContent>
    </Card>
  );
}

function CategoryEditor({
  checklistId,
  category,
  items,
  canEdit,
}: {
  checklistId: string;
  category: SemesterCategory;
  items: SemesterItem[];
  canEdit: boolean;
}) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const { data: allOptions = [] } = useItemOptions();
  const baseItems = useMemo(() => {
    const fromDb = allOptions.filter((o) => o.category === category).map((o) => o.label);
    // Fall back to constants only when the database has no options for this category yet
    const fromConst = fromDb.length === 0 ? (SEMESTER_BASE_ITEMS[category] ?? []) : [];
    return Array.from(new Set([...fromDb, ...fromConst]));
  }, [category, allOptions]);
  const isFurnitureCategory = category === 'Mobiliário';
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    item_name: baseItems[0] ?? '',
    custom: '',
    quantity: 1,
    maintenance_type: 'internal' as 'internal' | 'external',
    needs_ticket: false,
    needs_label: isFurnitureCategory, // Mobiliário sempre gera etiqueta por padrão
    observation: '',
  });

  const submit = async () => {
    const name = form.item_name === '__custom__' ? form.custom.trim() : form.item_name;
    if (!name) return toast.error('Informe o item');
    await createItem.mutateAsync({
      checklist_id: checklistId,
      category,
      item_name: name,
      quantity: form.quantity || 1,
      maintenance_type: form.maintenance_type,
      needs_ticket: form.needs_ticket,
      needs_label: form.needs_label,
      observation: form.observation || null,
    });
    toast.success('Item adicionado');
    setAdding(false);
    setForm({
      item_name: baseItems[0] ?? '__custom__',
      custom: '',
      quantity: 1,
      maintenance_type: 'internal',
      needs_ticket: false,
      needs_label: isFurnitureCategory,
      observation: '',
    });
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Nenhum item registrado nesta categoria.</p>
      )}
      {items.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          category={category}
          canEdit={canEdit}
          onDelete={() => deleteItem.mutate(it.id)}
          onUpdate={(patch) => updateItem.mutate({ id: it.id, patch })}
        />
      ))}

      {canEdit && !adding && (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar item
        </Button>
      )}

      {adding && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Item</Label>
              <Select value={form.item_name} onValueChange={(v) => setForm({ ...form, item_name: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {baseItems.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
              {form.item_name === '__custom__' && (
                <Input
                  className="mt-2"
                  placeholder="Descreva o item"
                  value={form.custom}
                  onChange={(e) => setForm({ ...form, custom: e.target.value })}
                />
              )}
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Manutenção</Label>
              <Select
                value={form.maintenance_type}
                onValueChange={(v) => setForm({ ...form, maintenance_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.needs_ticket} onCheckedChange={(v) => setForm({ ...form, needs_ticket: v })} />
                Precisa chamado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.needs_label} onCheckedChange={(v) => setForm({ ...form, needs_label: v })} />
                Gerar etiqueta
              </label>
            </div>
            <div className="md:col-span-2">
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={form.observation}
                onChange={(e) => setForm({ ...form, observation: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={createItem.isPending}>Adicionar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  category,
  canEdit,
  onDelete,
  onUpdate,
}: {
  item: SemesterItem;
  category: SemesterCategory;
  canEdit: boolean;
  onDelete: () => void;
  onUpdate: (patch: Partial<SemesterItem>) => void;
}) {
  const [openFurniture, setOpenFurniture] = useState(false);
  const isFurnitureRelevant = category === 'Mobiliário';

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h4 className="font-medium">{item.item_name}</h4>
            <Badge variant="secondary">{item.quantity}x</Badge>
            {item.maintenance_type && (
              <Badge variant="outline">{item.maintenance_type === 'internal' ? 'Interna' : 'Externa'}</Badge>
            )}
            <Badge className={`${statusColor(item.status)} text-white`}>{statusLabel(item.status)}</Badge>
            {item.needs_ticket && <Badge variant="outline">Chamado</Badge>}
            {item.needs_label && <Badge variant="outline">Etiqueta</Badge>}
          </div>
          {item.observation && <p className="text-sm text-muted-foreground mt-1">{item.observation}</p>}
        </div>
        <div className="flex gap-2">
          {isFurnitureRelevant && (
            <Button size="sm" variant="outline" onClick={() => setOpenFurniture(true)}>
              <Armchair className="h-4 w-4 mr-1" /> Detalhar
            </Button>
          )}
          {canEdit && (
            <>
              <Select value={item.status} onValueChange={(v) => onUpdate({ status: v as any })}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEMESTER_ITEM_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {openFurniture && (
        <FurnitureDialog itemId={item.id} canEdit={canEdit} onClose={() => setOpenFurniture(false)} />
      )}
    </div>
  );
}

function FurnitureDialog({ itemId, canEdit, onClose }: { itemId: string; canEdit: boolean; onClose: () => void }) {
  const { data: details = [] } = useFurnitureDetails(itemId);
  const { data: allOptions = [] } = useItemOptions();
  const create = useCreateFurniture();
  const del = useDeleteFurniture();

  const typeOptions = useMemo(() => {
    const db = allOptions.filter((o) => o.category === FURNITURE_TYPES_CATEGORY).map((o) => o.label);
    return db.length ? db : [...FURNITURE_ITEM_TYPES];
  }, [allOptions]);

  const problemOptions = useMemo(() => {
    const db = allOptions.filter((o) => o.category === FURNITURE_PROBLEMS_CATEGORY).map((o) => o.label);
    return db.length ? db : [...FURNITURE_PROBLEMS];
  }, [allOptions]);

  const [form, setForm] = useState<{
    item_type: string;
    problems: string[];
    quantity: number;
    maintenance_type: 'internal' | 'external';
    observation: string;
  }>({
    item_type: typeOptions[0] ?? 'Carteira',
    problems: problemOptions[0] ? [problemOptions[0]] : [],
    quantity: 1,
    maintenance_type: 'internal',
    observation: '',
  });

  // Sincroniza defaults quando as opções chegam do banco
  useEffect(() => {
    setForm((f) => ({
      ...f,
      item_type: typeOptions.includes(f.item_type) ? f.item_type : (typeOptions[0] ?? f.item_type),
      problems: f.problems.length ? f.problems : (problemOptions[0] ? [problemOptions[0]] : []),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeOptions.join('|'), problemOptions.join('|')]);


  const toggleProblem = (p: string) => {
    setForm((f) => ({
      ...f,
      problems: f.problems.includes(p) ? f.problems.filter((x) => x !== p) : [...f.problems, p],
    }));
  };

  const submit = async () => {
    if (form.problems.length === 0) return toast.error('Selecione ao menos um problema');
    await create.mutateAsync({
      checklist_item_id: itemId,
      item_type: form.item_type,
      problem_type: form.problems.join(' + '),
      quantity: form.quantity || 1,
      maintenance_type: form.maintenance_type,
      observation: form.observation || null,
    });
    toast.success('Detalhe adicionado');
    setForm({ ...form, quantity: 1, observation: '', problems: [FURNITURE_PROBLEMS[0]] });
  };

  const totals = useMemo(() => {
    const byProblem: Record<string, number> = {};
    details.forEach((d) => {
      // problem_type pode conter múltiplos problemas separados por " + " ou ","
      const parts = (d.problem_type || '').split(/\s*\+\s*|\s*,\s*/).filter(Boolean);
      parts.forEach((p) => {
        byProblem[p] = (byProblem[p] ?? 0) + d.quantity;
      });
    });
    return byProblem;
  }, [details]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhamento de carteiras/cadeiras</DialogTitle>
        </DialogHeader>

        {Object.keys(totals).length > 0 && (
          <div className="rounded-lg bg-muted/50 p-3 flex flex-wrap gap-2 text-sm">
            <span className="font-medium">Totais por problema:</span>
            {Object.entries(totals).map(([p, q]) => (
              <Badge key={p} variant="secondary">{p}: {q}</Badge>
            ))}
          </div>
        )}

        <div className="divide-y border rounded">
          {details.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum detalhe.</div>}
          {details.map((d) => {
            const probs = (d.problem_type || '').split(/\s*\+\s*|\s*,\s*/).filter(Boolean);
            return (
              <div key={d.id} className="p-3 flex items-start justify-between gap-2">
                <div className="text-sm flex-1">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <strong>{d.quantity}x</strong>
                    <span>{d.item_type}</span>
                    <Badge variant="outline">{d.maintenance_type === 'internal' ? 'Interna' : 'Externa'}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {probs.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[11px]">{p}</Badge>
                    ))}
                  </div>
                  {d.observation && <p className="text-xs text-muted-foreground mt-1">{d.observation}</p>}
                </div>
                {canEdit && (
                  <Button size="sm" variant="destructive" onClick={() => del.mutate(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {canEdit && (
          <div className="border rounded p-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FURNITURE_ITEM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Manutenção</Label>
                <Select value={form.maintenance_type} onValueChange={(v) => setForm({ ...form, maintenance_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Problemas (selecione um ou mais)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1 p-3 border rounded bg-background">
                {FURNITURE_PROBLEMS.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.problems.includes(p)}
                      onChange={() => toggleProblem(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
              {form.problems.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Os problemas selecionados aparecerão juntos na mesma etiqueta.
                </p>
              )}
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea rows={2} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={submit} disabled={create.isPending}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
