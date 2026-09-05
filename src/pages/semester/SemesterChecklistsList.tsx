import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCompetencies,
  useSemesterChecklists,
  useDeleteChecklist,
  useAllItems,
  useAllFurniture,
  useCompetencyLabels,
  useAllProjectors,
} from '@/hooks/useSemesterChecklist';
import { SEMESTER_CATEGORIES, competencyStatusLabel, statusColor, statusLabel } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus,
  Eye,
  Trash2,
  Search,
  ClipboardCheck,
  Wrench,
  Armchair,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Building2,
  FileText,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { ContentState } from '@/components/layout/ContentState';
import { StatCard } from '@/components/dashboard/StatCard';
import { SemesterModuleNav } from '@/components/semester/SemesterModuleNav';

export default function SemesterChecklistsList() {
  const { isAdmin } = useAuth();
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState<string>('all');
  const compId = competencyId === 'all' ? undefined : competencyId;
  const [search, setSearch] = useState('');
  const { data: list = [], isLoading } = useSemesterChecklists(compId);
  const { data: items = [] } = useAllItems(compId);
  const { data: furniture = [] } = useAllFurniture(compId);
  const { data: projectorsAll = [] } = useAllProjectors(compId);
  const { data: labels = [] } = useCompetencyLabels(compId);
  const del = useDeleteChecklist();

  const stats = useMemo(() => {
    const totalRooms = new Set(list.map((c) => c.room_id ?? c.room_name)).size;
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
  }, [list, items, furniture]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.room_name, c.responsible_name, c.campus].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [list, search]);

  return (
    <MainLayout>
      <div className="mb-6">
        <SemesterModuleNav />
      </div>

      <div className="space-y-6">
        <PageHeader
          title="Checklist Semestral"
          description="Indicadores, navegação rápida e levantamentos por sala"
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/semester/summary">
                  <FileText className="mr-1 h-4 w-4" />
                  Resumo p/ Chamados
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/semester/labels">
                  <Tag className="mr-1 h-4 w-4" />
                  Etiquetas
                </Link>
              </Button>
              {isAdmin && (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/semester/competencies">
                      <SettingsIcon className="mr-1 h-4 w-4" />
                      Competências
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/semester/item-options">
                      <SettingsIcon className="mr-1 h-4 w-4" />
                      Opções de Itens
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/semester/new">
                      <Plus className="mr-1 h-4 w-4" />
                      Novo levantamento
                    </Link>
                  </Button>
                </>
              )}
            </>
          }
        />

        <PageToolbar className="mb-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger>
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas competências</SelectItem>
                {competencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({competencyStatusLabel(c.status)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar sala, campus, responsável..."
                className="pl-9 pr-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setSearch('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </PageToolbar>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Salas vistoriadas" value={stats.totalRooms} icon={<Building2 className="h-5 w-5" />} />
          <StatCard title="Itens levantados" value={stats.totalItems} icon={<ClipboardCheck className="h-5 w-5" />} />
          <StatCard title="Carteiras/cadeiras" value={stats.totalFurniture} icon={<Armchair className="h-5 w-5" />} />
          <StatCard title="Etiquetas geradas" value={labels.length} icon={<Tag className="h-5 w-5" />} />
          <StatCard title="Internas" value={stats.internal} icon={<Wrench className="h-5 w-5" />} />
          <StatCard title="Externas" value={stats.external} icon={<Wrench className="h-5 w-5" />} />
          <StatCard title="Pendentes de chamado" value={stats.pendingTicket} icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title="Chamados abertos" value={stats.openedTickets} icon={<Inbox className="h-5 w-5" />} />
          <StatCard title="Concluídos / Baixados" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
        </div>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Itens por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byCategory).map(([cat, qty]) =>
                qty > 0 ? (
                  <Badge key={cat} variant="default" className="text-sm">
                    {cat}: {qty}
                  </Badge>
                ) : (
                  <Badge key={cat} variant="outline" className="text-sm">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {cat}: em conformidade
                  </Badge>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Levantamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <ContentState loading title="Carregando levantamentos" description="Buscando os dados desta competência." className="m-4" />
            ) : filtered.length === 0 ? (
              <ContentState
                icon={ClipboardCheck}
                title="Nenhum levantamento encontrado"
                description="Ajuste os filtros ou crie um novo levantamento."
                className="m-4"
              />
            ) : (
              <div className="divide-y divide-border/60">
                {filtered.map((c) => {
                  const comp = competencies.find((x) => x.id === c.competency_id);
                  const categoriesWithItems = new Set(
                    items.filter((it: any) => it.checklist_id === c.id).map((it: any) => it.category),
                  );
                  const confirmed: string[] = (c as any).confirmed_categories ?? [];
                  const doneCats = SEMESTER_CATEGORIES.filter(
                    (cat) => categoriesWithItems.has(cat) || confirmed.includes(cat),
                  ).length;
                  const hasProjectors = projectorsAll.some((p: any) => p.checklist_id === c.id);
                  const projectorsDone = hasProjectors || !!(c as any).projectors_confirmed;
                  const total = SEMESTER_CATEGORIES.length + 1;
                  const done = doneCats + (projectorsDone ? 1 : 0);
                  const progress = Math.round((done / total) * 100);
                  const progressColor =
                    progress === 100 ? 'text-emerald-600' : progress >= 50 ? 'text-amber-600' : 'text-muted-foreground';

                  return (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{c.room_name}</h3>
                          {c.campus && <Badge variant="outline">{c.campus}</Badge>}
                          <Badge className={`${statusColor(c.status)} text-white`}>{statusLabel(c.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {comp?.name && `${comp.name} • `}
                          Responsável: {c.responsible_name} • {format(new Date(c.checklist_date), 'dd/MM/yyyy')}
                          {(c as any).filled_by_name && <> • Preenchido por: {(c as any).filled_by_name}</>}
                        </p>
                        <div className="mt-2 max-w-md">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progresso do levantamento</span>
                            <span className={`font-medium ${progressColor}`}>{done}/{total} • {progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" asChild variant="outline">
                          <Link to={`/semester/${c.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Abrir
                          </Link>
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Excluir este levantamento?')) {
                                del.mutate(c.id, { onSuccess: () => toast.success('Excluído') });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
