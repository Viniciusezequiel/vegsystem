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
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import { StatCard } from '@/components/dashboard/StatCard';

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

    return {
      totalRooms,
      totalItems,
      totalFurniture,
      internal,
      external,
      pendingTicket,
      openedTickets,
      completed,
      byCategory,
    };
  }, [checklists, items, furniture]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard — Checklist Semestral"
          description="Indicadores de manutenção por competência"
          actions={
            <div className="w-full sm:w-72">
              <Select value={competencyId} onValueChange={setCompetencyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas competências</SelectItem>
                  {competencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Salas vistoriadas" value={stats.totalRooms} icon={<Building2 className="h-5 w-5" />} />
          <StatCard title="Itens levantados" value={stats.totalItems} icon={<ClipboardCheck className="h-5 w-5" />} />
          <StatCard title="Carteiras/cadeiras" value={stats.totalFurniture} icon={<Armchair className="h-5 w-5" />} />
          <StatCard title="Etiquetas geradas" value={labels.length} icon={<Tag className="h-5 w-5" />} />
          <StatCard title="Manutenções internas" value={stats.internal} icon={<Wrench className="h-5 w-5" />} />
          <StatCard title="Manutenções externas" value={stats.external} icon={<Wrench className="h-5 w-5" />} />
          <StatCard title="Pendentes de chamado" value={stats.pendingTicket} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title="Chamados abertos" value={stats.openedTickets} icon={<Inbox className="h-5 w-5" />} />
          <StatCard title="Concluídos / Baixados" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Itens por categoria</CardTitle>
          </CardHeader>
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

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por status</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <ContentState
                icon={Inbox}
                title="Sem dados nesta competência"
                description="Os indicadores aparecerão assim que houver itens levantados."
                className="min-h-[140px]"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  items.reduce<Record<string, number>>((acc, i) => {
                    acc[i.status] = (acc[i.status] ?? 0) + 1;
                    return acc;
                  }, {}),
                ).map(([s, q]) => (
                  <Badge key={s} variant="secondary" className="text-sm">
                    {statusLabel(s)}: {q}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
