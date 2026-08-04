import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, MapPin, Plus, Search, Trash2, ArrowRight } from 'lucide-react';
import { usePsEvents, usePsEventMutations } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

export default function PsEvents() {
  const { data: events = [], isLoading } = usePsEvents();
  const { save, remove } = usePsEventMutations();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', date: '', location: '', description: '', status: 'planejamento', coordinator_name: '', notes: '' });

  const filtered = events.filter((e: any) =>
    [e.name, e.location, e.coordinator_name].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!form.name || !form.date) return;
    await save.mutateAsync(form);
    setOpen(false);
    setForm({ name: '', date: '', location: '', description: '', status: 'planejamento', coordinator_name: '', notes: '' });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Eventos</h1>
            <p className="text-muted-foreground">Processos seletivos cadastrados.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo evento</Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar evento..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Nenhum evento encontrado.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((e: any) => (
              <Card key={e.id} className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <Badge variant={e.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[e.status] || e.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  {e.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{e.location}</p>}
                  <div className="flex gap-2 pt-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link to={`/admin-module/processo-seletivo/eventos/${e.id}`}>Abrir <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm('Excluir evento?')) remove.mutate(e.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Data *</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Local</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Coordenador</Label><Input value={form.coordinator_name} onChange={(e) => setForm({ ...form, coordinator_name: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PS_EVENT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
