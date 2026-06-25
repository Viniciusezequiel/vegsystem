import { useMemo, useState } from 'react';
import {
  useCompetencies,
  useSemesterChecklists,
  useAllItems,
  useAllFurniture,
  useCompetencyLabels,
} from '@/hooks/useSemesterChecklist';
import { SEMESTER_CATEGORIES, statusLabel } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardCheck,
  Wrench,
  Armchair,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Building2,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SemesterDashboard() {
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState('all');
  const compId = competencyId === 'all' ? undefined : competencyId;
  const { data: checklists = [] } = useSemesterChecklists(compId);
  const { data: items = [] } = useAllItems(compId);
  const { data: furniture = [] } = useAllFurniture(compId);
  const { data: labels = [] } = useCompetencyLabels(compId);

  const stats = useMemo(() => {
    const totalRooms = new Set(checklists.map((c) => c.room_id ?? c.room_name)).size;
    const totalItems = items.length;
    const totalFurniture = furniture.reduce((s, f) => s + (f.quantity ?? 0), 0);
    const internal = items.filter((i) => i.maintenance_type === 'internal').length;
    const external = items.filter((i) => i.maintenance_type === 'external').length;
    const pendingTicket = items.filter((i) => i.needs_ticket && i.status === 'pending_ticket').length;
    const openedTickets = items.filter((i) => i.status === 'ticket_opened').length;
    const completed = items.filter((i) => i.status === 'completed' || i.status === 'written_off').length;

    const byCategory: Record<string, number> = {};
    SEMESTER_CATEGORIES.forEach((c) => (byCategory[c] = 0));
    items.forEach((i) => {
      byCategory[i.category] = (byCategory[i.category] ?? 0) + (i.quantity ?? 1);
    });

    return { totalRooms, totalItems, totalFurniture, internal, external, pendingTicket, openedTickets, completed, byCategory };
  }, [checklists, items, furniture]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard — Checklist Semestral</h1>
          <p className="text-sm text-muted-foreground">Indicadores de manutenção por competência.</p>
        </div>
        <div className="w-72">
          <Select value={competencyId} onValueChange={setCompetencyId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas competências</SelectItem>
              {competencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Salas vistoriadas" value={stats.totalRooms} color="bg-blue-500" />
        <StatCard icon={ClipboardCheck} label="Itens levantados" value={stats.totalItems} color="bg-emerald-500" />
        <StatCard icon={Armchair} label="Carteiras/cadeiras" value={stats.totalFurniture} color="bg-amber-500" />
        <StatCard icon={Tag} label="Etiquetas geradas" value={labels.length} color="bg-violet-500" />
        <StatCard icon={Wrench} label="Manutenções internas" value={stats.internal} color="bg-indigo-500" />
        <StatCard icon={Wrench} label="Manutenções externas" value={stats.external} color="bg-pink-500" />
        <StatCard icon={AlertTriangle} label="Pendentes de chamado" value={stats.pendingTicket} color="bg-orange-500" />
        <StatCard icon={Inbox} label="Chamados abertos" value={stats.openedTickets} color="bg-cyan-600" />
        <StatCard icon={CheckCircle2} label="Concluídos / Baixados" value={stats.completed} color="bg-green-600" />
      </div>

      <Card>
        <CardHeader><CardTitle>Itens por categoria</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([cat, qty]) => (
              <Badge key={cat} variant={qty > 0 ? 'default' : 'outline'} className="text-sm">
                {cat}: {qty}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Distribuição por status</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(
                items.reduce<Record<string, number>>((acc, i) => {
                  acc[i.status] = (acc[i.status] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([s, q]) => (
                <Badge key={s} variant="secondary" className="text-sm">{statusLabel(s)}: {q}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
