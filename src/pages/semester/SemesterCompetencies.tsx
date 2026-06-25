import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCompetencies,
  useUpsertCompetency,
  useUpdateCompetencyStatus,
  useDeleteCompetency,
  type Competency,
  type CompetencyStatus,
} from '@/hooks/useSemesterChecklist';
import { competencyStatusLabel, competencyStatusColor } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Lock, Unlock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { MainLayout } from '@/components/layout/MainLayout';

export default function SemesterCompetencies() {
  const { isAdmin, profile } = useAuth();
  const { data: items = [], isLoading } = useCompetencies();
  const upsert = useUpsertCompetency();
  const updateStatus = useUpdateCompetencyStatus();
  const del = useDeleteCompetency();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', status: 'draft' as CompetencyStatus });

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-orange-500" />
        <p className="mt-3 text-muted-foreground">Apenas administradores podem gerenciar competências.</p>
      </div>
    );
  }

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', start_date: '', end_date: '', status: 'draft' });
    setOpen(true);
  };
  const openEdit = (c: Competency) => {
    setEditing(c);
    setForm({
      name: c.name,
      start_date: c.start_date ?? '',
      end_date: c.end_date ?? '',
      status: c.status,
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return toast.error('Informe o nome da competência');
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        created_by_name: profile?.full_name ?? null,
      });
      toast.success('Competência salva');
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (<MainLayout>
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competências — Checklist Semestral</h1>
          <p className="text-sm text-muted-foreground">Crie, libere, bloqueie ou finalize competências.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova competência</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma competência cadastrada.</div>
          ) : (
            <div className="divide-y">
              {items.map((c) => (
                <div key={c.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.name}</h3>
                      <Badge className={`${competencyStatusColor(c.status)} text-white`}>{competencyStatusLabel(c.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}
                      {' até '}
                      {c.end_date ? format(new Date(c.end_date), 'dd/MM/yyyy') : '—'}
                      {c.created_by_name && ` • Criada por ${c.created_by_name}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status !== 'released' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'released' })}>
                        <Unlock className="h-4 w-4 mr-1" /> Liberar
                      </Button>
                    )}
                    {c.status === 'released' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'blocked' })}>
                        <Lock className="h-4 w-4 mr-1" /> Bloquear
                      </Button>
                    )}
                    {c.status !== 'finished' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'finished' })}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Finalizar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Excluir competência "${c.name}"? Isto remove todos os checklists associados.`)) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar competência' : 'Nova competência'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: 2026/1º semestre" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CompetencyStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="released">Liberada</SelectItem>
                  <SelectItem value="blocked">Bloqueada</SelectItem>
                  <SelectItem value="finished">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </MainLayout>);
}
