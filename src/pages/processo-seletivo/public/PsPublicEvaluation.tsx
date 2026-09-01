import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, CheckCircle2, Search } from 'lucide-react';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { useQuery } from '@tanstack/react-query';
import { usePsEvents, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { PS_CRITERIA } from '@/lib/psConstants';
import { toast } from 'sonner';
import { filterPublicRoster } from '@/lib/psPublicFilters.mjs';

export default function PsPublicEvaluation() {
  const { eventId: routeEventId } = useParams();
  const { data: events = [] } = usePsEvents();
  const visibleEvents = useMemo(
    () => events.filter((e: any) => !e.hidden_from_evaluation),
    [events],
  );

  const [eventId, setEventId] = useState<string>(routeEventId || '');
  const [search, setSearch] = useState('');
  const { data: links = [], isLoading, error } = useQuery({
    queryKey: ['ps_public_evaluation_roster', eventId],
    enabled: !!eventId,
    refetchInterval: 3_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ps_public_search_event_roster', {
        p_event_id: eventId,
        p_search: '',
      });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        matricula_masked: row.matricula_masked ?? null,
        email_masked: row.email_masked ?? null,
      }));
    },
  });
  const { data: roles = [] } = usePsRoles();

  const [collaboratorId, setCollaboratorId] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const [observations, setObservations] = useState('');
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const roster = useMemo(() => filterPublicRoster(links, search), [links, search]);
  const selected = roster.find((l: any) => l.id === collaboratorId) || links.find((l: any) => l.id === collaboratorId) || null;

  const submit = async () => {
    if (!eventId || !selected || !evaluatorName.trim()) {
      toast.error('Preencha evento, fiscal avaliado e seu nome.');
      return;
    }
    if (PS_CRITERIA.some((c) => !criteria[c.key])) {
      toast.error('Avalie todos os critérios.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('ps_public_submit_evaluation', {
      p_event_id: eventId,
      p_link_id: selected.id,
      p_assigned_role: assignedRole || selected.assigned_role || 'fiscal_sala',
      p_evaluator_name: evaluatorName.trim(),
      p_observations: observations.trim() || null,
      p_criteria: criteria as any,
    });
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' || /duplicate|unique/i.test(error.message)
        ? 'Este fiscal já possui avaliação neste evento.'
        : error.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Avaliação enviada!</CardTitle>
            <CardDescription>Obrigado pela sua contribuição.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                setDone(false);
                setCollaboratorId('');
                setCriteria(emptyCriteria());
                setObservations('');
              }}
            >
              Avaliar outro fiscal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Avaliação de Fiscais</h1>
            <p className="text-muted-foreground">Selecione o fiscal e avalie o evento.</p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setCollaboratorId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {visibleEvents.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setCollaboratorId(''); }} placeholder="Buscar fiscal por nome, cargo, unidade ou sala" disabled={!eventId} />
            </div>

            <div className="space-y-2">
              <Label>Fiscais do evento</Label>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border p-2">
                {isLoading && <p className="p-2 text-sm text-muted-foreground">Carregando fiscais...</p>}
                {!isLoading && !error && roster.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">{search ? 'Nenhum fiscal encontrado para esta busca.' : 'Nenhum fiscal vinculado a este evento.'}</p>
                )}
                {!isLoading && error && (
                  <div className="space-y-2 p-2">
                    <p className="text-sm text-destructive">Não foi possível carregar a lista de fiscais.</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Tentar novamente</Button>
                  </div>
                )}
                {!isLoading && !error && roster.map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setCollaboratorId(l.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/60 ${collaboratorId === l.id ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.collaborator_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[l.role_name || l.assigned_role, l.unit, l.room && `Sala ${l.room}`].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                    <Button type="button" size="sm">Avaliar</Button>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cargo exercido</Label>
              <Select value={assignedRole} onValueChange={setAssignedRole}>
                <SelectTrigger><SelectValue placeholder={selected?.assigned_role || 'Selecione o cargo'} /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => (
                    <SelectItem key={r.id} value={r.value}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Seu nome (avaliador)</Label>
              <Input value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} placeholder="Nome completo" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Critérios (1 a 5)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <PsCriteriaFields values={criteria} onChange={setCriteria} />
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={4} />
            </div>
            <Button className="w-full" onClick={submit} disabled={saving || !selected}>
              {saving ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
