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
} from '@/hooks/useSemesterChecklist';
import { SEMESTER_CATEGORIES, competencyStatusLabel, statusColor, statusLabel } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Eye, Trash2, Search, ClipboardCheck, Wrench, Armchair, Tag,
  AlertTriangle, CheckCircle2, Inbox, Building2, FileText, Settings as SettingsIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
          <div className="text-lg font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SemesterChecklistsList() {
  const { isAdmin } = useAuth();
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState<string>('all');
  const compId = competencyId === 'all' ? undefined : competencyId;
  const [search, setSearch] = useState('');
  const { data: list = [], isLoading } = useSemesterChecklists(compId);
  const { data: items = [] } = useAllItems(compId);
  const { data: furniture = [] } = useAllFurniture(compId);
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

    return { totalRooms, totalItems, totalFurniture, internal, external, pendingTicket, openedTickets, completed, byCategory };
  }, [list, items, furniture]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      [c.room_name, c.responsible_name, c.campus].filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }, [list, search]);

  return (<MainLayout>
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Checklist Semestral</h1>
          <p className="text-sm text-muted-foreground">Painel principal — indicadores, navegação rápida e levantamentos por sala.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/semester/summary"><FileText className="h-4 w-4 mr-1" /> Resumo p/ Chamados</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/semester/labels"><Tag className="h-4 w-4 mr-1" /> Etiquetas</Link></Button>
          {isAdmin && (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/semester/competencies"><SettingsIcon className="h-4 w-4 mr-1" /> Competências</Link></Button>
              <Button asChild variant="outline" size="sm"><Link to="/semester/item-options"><SettingsIcon className="h-4 w-4 mr-1" /> Opções de Itens</Link></Button>
              <Button asChild size="sm"><Link to="/semester/new"><Plus className="h-4 w-4 mr-1" /> Novo levantamento</Link></Button>
            </>
          )}
        </div>
      </div>

      {/* Filtro de competência (aplica em stats + lista) */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={competencyId} onValueChange={setCompetencyId}>
            <SelectTrigger><SelectValue placeholder="Competência" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas competências</SelectItem>
              {competencies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({competencyStatusLabel(c.status)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar sala, campus, responsável..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Stats inline */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard icon={Building2} label="Salas vistoriadas" value={stats.totalRooms} color="bg-blue-500" />
        <StatCard icon={ClipboardCheck} label="Itens levantados" value={stats.totalItems} color="bg-emerald-500" />
        <StatCard icon={Armchair} label="Carteiras/cadeiras" value={stats.totalFurniture} color="bg-amber-500" />
        <StatCard icon={Tag} label="Etiquetas geradas" value={labels.length} color="bg-violet-500" />
        <StatCard icon={Wrench} label="Internas" value={stats.internal} color="bg-indigo-500" />
        <StatCard icon={Wrench} label="Externas" value={stats.external} color="bg-pink-500" />
        <StatCard icon={AlertTriangle} label="Pendentes de chamado" value={stats.pendingTicket} color="bg-orange-500" />
        <StatCard icon={Inbox} label="Chamados abertos" value={stats.openedTickets} color="bg-cyan-600" />
        <StatCard icon={CheckCircle2} label="Concluídos / Baixados" value={stats.completed} color="bg-green-600" />
      </div>

      {/* Categorias - vazias contam como conforme */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Itens por categoria</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byCategory).map(([cat, qty]) => (
              qty > 0 ? (
                <Badge key={cat} variant="default" className="text-sm">
                  {cat}: {qty}
                </Badge>
              ) : (
                <Badge key={cat} variant="outline" className="text-sm bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {cat}: em conformidade
                </Badge>
              )
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Levantamentos</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum levantamento encontrado.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => {
                const comp = competencies.find((x) => x.id === c.competency_id);
                const categoriesWithItems = new Set(
                  items.filter((it: any) => it.checklist_id === c.id).map((it: any) => it.category),
                );
                const confirmed: string[] = (c as any).confirmed_categories ?? [];
                const doneCats = SEMESTER_CATEGORIES.filter(
                  (cat) => categoriesWithItems.has(cat) || confirmed.includes(cat),
                ).length;
                const progress = Math.round((doneCats / SEMESTER_CATEGORIES.length) * 100);
                const progressColor =
                  progress === 100 ? 'text-emerald-600' : progress >= 50 ? 'text-amber-600' : 'text-muted-foreground';
                return (
                  <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-semibold">{c.room_name}</h3>
                        {c.campus && <Badge variant="outline">{c.campus}</Badge>}
                        <Badge className={`${statusColor(c.status)} text-white`}>{statusLabel(c.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comp?.name && `${comp.name} • `}
                        Responsável: {c.responsible_name} • {format(new Date(c.checklist_date), 'dd/MM/yyyy')}
                      </p>
                      <div className="mt-2 max-w-md">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progresso do levantamento</span>
                          <span className={`font-medium ${progressColor}`}>{doneCats}/{SEMESTER_CATEGORIES.length} • {progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" asChild variant="outline">
                        <Link to={`/semester/${c.id}`}><Eye className="h-4 w-4 mr-1" /> Abrir</Link>
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
  </MainLayout>);
}
