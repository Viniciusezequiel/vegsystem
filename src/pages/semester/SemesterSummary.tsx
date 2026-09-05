import { useMemo, useState } from 'react';
import { useCompetencies, useAllItems, useAllFurniture } from '@/hooks/useSemesterChecklist';
import { statusLabel } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, FileSpreadsheet, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';

interface GroupRow {
  room: string;
  floor: string | null;
  category: string;
  item: string;
  quantity: number;
  problem?: string;
  observation?: string | null;
  responsible: string;
  date: string;
  status: string;
  maintenance?: string | null;
}

export default function SemesterSummary() {
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState('all');
  const compId = competencyId === 'all' ? undefined : competencyId;
  const { data: items = [] } = useAllItems(compId);
  const { data: furniture = [] } = useAllFurniture(compId);

  const rows = useMemo<GroupRow[]>(() => {
    const r: GroupRow[] = [];
    items.forEach((i) => {
      const ch = i.semester_checklists;
      r.push({
        room: ch?.room_name ?? '-',
        floor: ch?.floor ?? null,
        category: i.category,
        item: i.item_name,
        quantity: i.quantity ?? 1,
        observation: i.observation,
        responsible: ch?.responsible_name ?? '-',
        date: ch?.checklist_date ?? '-',
        status: i.status,
        maintenance: i.maintenance_type,
      });
    });
    furniture.forEach((f) => {
      const ch = f.semester_checklist_items?.semester_checklists;
      r.push({
        room: ch?.room_name ?? '-',
        floor: ch?.floor ?? null,
        category: 'Mobiliário',
        item: f.item_type,
        quantity: f.quantity ?? 1,
        problem: f.problem_type,
        observation: f.observation,
        responsible: ch?.responsible_name ?? '-',
        date: ch?.checklist_date ?? '-',
        status: f.status,
        maintenance: f.maintenance_type,
      });
    });
    return r;
  }, [items, furniture]);

  const grouped = useMemo(() => {
    const g: Record<string, Record<string, GroupRow[]>> = {};
    rows.forEach((r) => {
      g[r.room] = g[r.room] || {};
      g[r.room][r.category] = g[r.room][r.category] || [];
      g[r.room][r.category].push(r);
    });
    return g;
  }, [rows]);

  const textSummary = useMemo(() => {
    const lines: string[] = [];
    Object.entries(grouped).forEach(([room, cats]) => {
      Object.entries(cats).forEach(([cat, list]) => {
        lines.push(`${room} — ${cat}`);
        list.forEach((it) => {
          lines.push(
            `  - ${it.quantity}x ${it.item}${it.problem ? ` (${it.problem})` : ''}` +
              (it.maintenance ? ` [${it.maintenance === 'internal' ? 'Interna' : 'Externa'}]` : '') +
              ` — ${statusLabel(it.status)}`,
          );
          if (it.observation) lines.push(`    obs: ${it.observation}`);
        });
        lines.push('');
      });
    });
    return lines.join('\n');
  }, [grouped]);

  const copy = async () => {
    await navigator.clipboard.writeText(textSummary || '');
    toast.success('Resumo copiado');
  };

  const exportXlsx = () => {
    const data = rows.map((r) => ({
      Sala: r.room,
      Andar: r.floor ?? '',
      Categoria: r.category,
      Item: r.item,
      Problema: r.problem ?? '',
      Quantidade: r.quantity,
      Manutenção: r.maintenance === 'internal' ? 'Interna' : r.maintenance === 'external' ? 'Externa' : '',
      Observação: r.observation ?? '',
      Responsável: r.responsible,
      Data: r.date,
      Status: statusLabel(r.status),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumo Chamados');
    XLSX.writeFile(wb, `checklist-semestral-resumo-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Resumo para Chamados"
          description="Agrupamento por sala e categoria para abertura de chamados de manutenção"
          actions={
            <>
              <Button variant="outline" onClick={copy} disabled={!rows.length}>
                <Copy className="mr-1 h-4 w-4" />
                Copiar texto
              </Button>
              <Button variant="outline" onClick={exportXlsx} disabled={!rows.length}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          }
        />

        <PageToolbar className="mb-0">
          <div className="w-full sm:max-w-xs">
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas competências</SelectItem>
                {competencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PageToolbar>

        {Object.keys(grouped).length === 0 ? (
          <ContentState
            icon={Inbox}
            title="Sem dados para esta competência"
            description="Os itens aparecerão aqui quando houver levantamentos com manutenção registrada."
          />
        ) : (
          Object.entries(grouped).map(([room, cats]) => (
            <Card key={room} className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{room}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(cats).map(([cat, list]) => (
                  <div key={cat} className="rounded-lg border border-border/50 bg-muted/10 p-3">
                    <h4 className="mb-2 font-semibold">{cat}</h4>
                    <ul className="space-y-2 text-sm">
                      {list.map((r, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge variant="secondary">{r.quantity}x</Badge>
                          <span className="flex-1">
                            {r.item}
                            {r.problem && <span className="text-muted-foreground"> — {r.problem}</span>}
                            {r.maintenance && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {r.maintenance === 'internal' ? 'Interna' : 'Externa'}
                              </Badge>
                            )}
                            {r.observation && <p className="mt-0.5 text-xs text-muted-foreground">{r.observation}</p>}
                          </span>
                          <Badge variant="outline" className="text-xs">{statusLabel(r.status)}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </MainLayout>
  );
}
