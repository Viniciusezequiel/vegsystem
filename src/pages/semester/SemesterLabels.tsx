import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCompetencies,
  useAllItems,
  useAllFurniture,
  useCreateLabels,
} from '@/hooks/useSemesterChecklist';
import { generateSemesterLabelsPdf, type SemesterLabelData } from '@/lib/semesterLabelPdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Printer, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';

interface Candidate {
  key: string;
  source: 'item' | 'furniture';
  sourceId: string;
  competencyId: string;
  competencyName: string;
  room: string;
  floor: string;
  itemType: string;
  problem: string;
  maintenance: string;
  responsible: string;
  date: string;
  quantity: number;
}

export default function SemesterLabels() {
  const { profile } = useAuth();
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState<string>('all');
  const compId = competencyId === 'all' ? undefined : competencyId;
  const { data: items = [] } = useAllItems(compId);
  const { data: furniture = [] } = useAllFurniture(compId);
  const createLabels = useCreateLabels();

  const [search, setSearch] = useState('');
  const [filterRoom, setFilterRoom] = useState('all');
  const [filterFloor, setFilterFloor] = useState('all');
  const [filterMaintenance, setFilterMaintenance] = useState<'all' | 'internal' | 'external'>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const candidates: Candidate[] = useMemo(() => {
    const list: Candidate[] = [];
    items.forEach((i) => {
      if (!i.needs_label) return;
      const ch = i.semester_checklists;
      const comp = competencies.find((c) => c.id === ch?.competency_id);
      list.push({
        key: `item:${i.id}`,
        source: 'item',
        sourceId: i.id,
        competencyId: ch?.competency_id ?? '',
        competencyName: comp?.name ?? '',
        room: ch?.room_name ?? '-',
        floor: ch?.floor ?? '-',
        itemType: i.item_name,
        problem: i.observation ?? i.category,
        maintenance: i.maintenance_type === 'external' ? 'Externa' : 'Interna',
        responsible: ch?.responsible_name ?? '-',
        date: ch?.checklist_date ?? '',
        quantity: i.quantity ?? 1,
      });
    });
    furniture.forEach((f) => {
      const ci = f.semester_checklist_items;
      const ch = ci?.semester_checklists;
      const comp = competencies.find((c) => c.id === ch?.competency_id);
      list.push({
        key: `furniture:${f.id}`,
        source: 'furniture',
        sourceId: f.id,
        competencyId: ch?.competency_id ?? '',
        competencyName: comp?.name ?? '',
        room: ch?.room_name ?? '-',
        floor: ch?.floor ?? '-',
        itemType: f.item_type,
        problem: f.problem_type,
        maintenance: f.maintenance_type === 'external' ? 'Externa' : 'Interna',
        responsible: ch?.responsible_name ?? '-',
        date: ch?.checklist_date ?? '',
        quantity: f.quantity ?? 1,
      });
    });
    return list;
  }, [items, furniture, competencies]);

  const rooms = useMemo(() => Array.from(new Set(candidates.map((c) => c.room))).sort(), [candidates]);
  const floors = useMemo(() => Array.from(new Set(candidates.map((c) => c.floor))).filter(Boolean).sort(), [candidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filterRoom !== 'all' && c.room !== filterRoom) return false;
      if (filterFloor !== 'all' && c.floor !== filterFloor) return false;
      if (filterMaintenance !== 'all' && c.maintenance.toLowerCase() !== (filterMaintenance === 'internal' ? 'interna' : 'externa')) return false;
      if (q && !`${c.room} ${c.itemType} ${c.problem} ${c.responsible}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [candidates, search, filterRoom, filterFloor, filterMaintenance]);

  const allSelected = filtered.length > 0 && filtered.every((c) => selected[c.key]);
  const toggleAll = () => {
    const next = { ...selected };
    if (allSelected) filtered.forEach((c) => delete next[c.key]);
    else filtered.forEach((c) => (next[c.key] = true));
    setSelected(next);
  };

  const generate = async () => {
    const chosen = filtered.filter((c) => selected[c.key]);
    if (chosen.length === 0) return toast.error('Selecione ao menos um item');

    // expandir por quantidade gerando sequência por grupo (sala/item/problema)
    type ExpandedRow = SemesterLabelData & {
      source: 'item' | 'furniture';
      sourceId: string;
      competencyId: string;
    };
    const expanded: ExpandedRow[] = [];
    chosen.forEach((c) => {
      const total = c.quantity;
      for (let n = 1; n <= total; n++) {
        const labelCode = `${c.competencyId.slice(0, 4).toUpperCase()}-${c.room.replace(/\s+/g, '')}-${c.itemType.slice(0, 4).toUpperCase()}-${Date.now().toString(36).slice(-4)}-${n}`;
        expanded.push({
          source: c.source,
          sourceId: c.sourceId,
          competencyId: c.competencyId,
          competency: c.competencyName,
          room: c.room,
          floor: c.floor,
          itemType: c.itemType,
          problem: c.problem,
          maintenance: c.maintenance,
          responsible: c.responsible,
          date: c.date ? format(new Date(c.date), 'dd/MM/yyyy') : '',
          labelCode,
          sequenceNumber: n,
          sequenceTotal: total,
        });
      }
    });

    // gerar PDF
    const doc = generateSemesterLabelsPdf(expanded);
    doc.save(`etiquetas-checklist-semestral-${format(new Date(), 'yyyyMMddHHmm')}.pdf`);

    // registrar no banco
    try {
      const rows = expanded.map((e) => ({
        checklist_item_id: e.source === 'item' ? e.sourceId : null,
        furniture_detail_id: e.source === 'furniture' ? e.sourceId : null,
        competency_id: e.competencyId || null,
        label_code: e.labelCode,
        sequence_number: e.sequenceNumber,
        sequence_total: e.sequenceTotal,
        generated_by: profile?.id ?? null,
        generated_by_name: profile?.full_name ?? null,
      }));
      await createLabels.mutateAsync(rows);
      toast.success(`${expanded.length} etiquetas geradas e registradas`);
    } catch (e: any) {
      toast.error(`PDF gerado, mas falha ao registrar no histórico: ${e.message}`);
    }
  };

  return (<MainLayout>
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Etiquetas — Checklist Semestral</h1>
          <p className="text-sm text-muted-foreground">Geração no padrão Pimaco A4365 (8 etiquetas por folha A4).</p>
        </div>
        <Button onClick={generate} disabled={createLabels.isPending}>
          <Printer className="h-4 w-4 mr-1" /> Gerar PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select value={competencyId} onValueChange={setCompetencyId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas competências</SelectItem>
              {competencies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRoom} onValueChange={setFilterRoom}>
            <SelectTrigger><SelectValue placeholder="Sala" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas salas</SelectItem>
              {rooms.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterFloor} onValueChange={setFilterFloor}>
            <SelectTrigger><SelectValue placeholder="Andar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos andares</SelectItem>
              {floors.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMaintenance} onValueChange={(v) => setFilterMaintenance(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda manutenção</SelectItem>
              <SelectItem value="internal">Interna</SelectItem>
              <SelectItem value="external">Externa</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Itens marcados para etiqueta</CardTitle>
          <Label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} /> Selecionar todos
          </Label>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum item marcado como "Gerar etiqueta" para os filtros atuais.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.key} className="p-3 flex items-start gap-3">
                  <Checkbox
                    checked={!!selected[c.key]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.key]: !!v }))}
                  />
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <strong>{c.room}</strong>
                      <Badge variant="outline">{c.floor}</Badge>
                      <Badge variant="outline">{c.maintenance}</Badge>
                      <Badge variant="secondary">{c.quantity} etiquetas</Badge>
                      <Badge variant="outline">{c.competencyName}</Badge>
                    </div>
                    <div className="text-sm mt-1">
                      <strong>{c.itemType}</strong> — {c.problem}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Responsável: {c.responsible} • {c.date && format(new Date(c.date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </MainLayout>);
}
