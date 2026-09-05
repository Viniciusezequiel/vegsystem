import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, Plus, Search, Trash2 } from 'lucide-react';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePsEventMutations, usePsEvents } from '@/hooks/useProcessoSeletivo';
import { PS_EVENT_STATUS } from '@/lib/psConstants';

const emptyForm = {
  name: '',
  date: '',
  location: '',
  description: '',
  status: 'planejamento',
  coordinator_name: '',
  notes: '',
};

export default function PsEvents() {
  const { data: events = [], isLoading } = usePsEvents();
  const { save, remove } = usePsEventMutations();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);

  const filtered = events.filter((event: any) =>
    [event.name, event.location, event.coordinator_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const submit = async () => {
    if (!form.name || !form.date) return;
    await save.mutateAsync(form);
    setOpen(false);
    setForm(emptyForm);
  };

  return (
    <MainLayout>
      <PageHeader
        title="Eventos"
        description="Cadastre e acompanhe os processos seletivos, datas, locais e responsáveis."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo evento
          </Button>
        }
      />

      <PageToolbar>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por evento, local ou coordenador..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
      </PageToolbar>

      <div className="mb-3 px-1 text-xs text-muted-foreground">
        {isLoading ? 'Carregando eventos...' : `${filtered.length} ${filtered.length === 1 ? 'evento encontrado' : 'eventos encontrados'}`}
      </div>

      {isLoading ? (
        <ContentState loading title="Carregando eventos" description="Buscando os processos seletivos cadastrados." />
      ) : filtered.length === 0 ? (
        <ContentState
          icon={CalendarDays}
          title="Nenhum evento encontrado"
          description={search ? 'Tente ajustar a busca para encontrar outros eventos.' : 'Crie o primeiro evento para começar a organizar o processo seletivo.'}
          action={!search ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Novo evento</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event: any) => (
            <Card key={event.id} className="group border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card/85 hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{event.name}</h2>
                    {event.coordinator_name && <p className="mt-1 truncate text-xs text-muted-foreground">Coord. {event.coordinator_name}</p>}
                  </div>
                  <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'} className="shrink-0">
                    {PS_EVENT_STATUS[event.status] || event.status}
                  </Badge>
                </div>

                <div className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {new Date(`${event.date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                  {event.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>
                      Abrir evento
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      if (confirm('Excluir evento?')) remove.mutate(event.id);
                    }}
                    aria-label={`Excluir ${event.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data *</Label>
                <Input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={value => setForm({ ...form, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PS_EVENT_STATUS).map(([key, value]) => <SelectItem key={key} value={key}>{value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Local</Label>
                <Input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Coordenador</Label>
                <Input value={form.coordinator_name} onChange={event => setForm({ ...form, coordinator_name: event.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={save.isPending || !form.name || !form.date}>
              {save.isPending ? 'Salvando...' : 'Salvar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
