import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCompetencies,
  useSemesterChecklists,
  useDeleteChecklist,
} from '@/hooks/useSemesterChecklist';
import { competencyStatusLabel, statusColor, statusLabel } from '@/lib/semesterChecklistConstants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';

export default function SemesterChecklistsList() {
  const { isAdmin } = useAuth();
  const { data: competencies = [] } = useCompetencies();
  const [competencyId, setCompetencyId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: list = [], isLoading } = useSemesterChecklists(competencyId === 'all' ? undefined : competencyId);
  const del = useDeleteChecklist();

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
          <h1 className="text-2xl font-bold">Checklist Semestral — Levantamentos</h1>
          <p className="text-sm text-muted-foreground">Visualize e gerencie os levantamentos por sala.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/semester/dashboard">Dashboard</Link></Button>
          <Button asChild variant="outline"><Link to="/semester/summary">Resumo p/ Chamados</Link></Button>
          {isAdmin && (
            <Button asChild variant="outline"><Link to="/semester/item-options">Opções de Itens</Link></Button>
          )}
          <Button asChild variant="outline"><Link to="/semester/labels">Etiquetas</Link></Button>
          <Button asChild><Link to="/semester/new"><Plus className="h-4 w-4 mr-1" /> Novo levantamento</Link></Button>
        </div>
      </div>

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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum levantamento encontrado.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => {
                const comp = competencies.find((x) => x.id === c.competency_id);
                return (
                  <div key={c.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-semibold">{c.room_name}</h3>
                        {c.floor && <Badge variant="outline">{c.floor}</Badge>}
                        {c.campus && <Badge variant="outline">{c.campus}</Badge>}
                        <Badge className={`${statusColor(c.status)} text-white`}>{statusLabel(c.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comp?.name && `${comp.name} • `}
                        Responsável: {c.responsible_name} • {format(new Date(c.checklist_date), 'dd/MM/yyyy')}
                      </p>
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
