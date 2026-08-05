import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, CheckCircle2 } from 'lucide-react';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { usePsEvents, usePsEventCollaborators, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { psFinalScore, psClassification, PS_CRITERIA } from '@/lib/psConstants';
import { toast } from 'sonner';

export default function PsPublicEvaluation() {
  const { eventId: routeEventId } = useParams();
  const { data: events = [] } = usePsEvents();
  const visibleEvents = useMemo(
    () => events.filter((e: any) => !e.hidden_from_evaluation),
    [events],
  );

  const [eventId, setEventId] = useState<string>(routeEventId || '');
  const { data: links = [] } = usePsEventCollaborators(eventId || undefined);
  const { data: roles = [] } = usePsRoles();

  const [collaboratorId, setCollaboratorId] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [evaluatorName, setEvaluatorName] = useState('');
  const [observations, setObservations] = useState('');
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const selected = links.find((l: any) => l.collaborator_id === collaboratorId || l.id === collaboratorId);

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
    const final_score = psFinalScore(criteria);
    const { error } = await supabase.from('ps_evaluations').insert({
      event_id: eventId,
      collaborator_id: selected.collaborator_id,
      collaborator_name: selected.collaborator_name,
      sector: selected.sector,
      assigned_role: assignedRole || selected.assigned_role || 'fiscal_sala',
      evaluator_name: evaluatorName.trim(),
      observations: observations.trim() || null,
      ...criteria,
      final_score,
      classification: psClassification(final_score),
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
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
            <p className="text-muted-foreground">Formulário público de avaliação por evento.</p>
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

            <div className="space-y-2">
              <Label>Fiscal avaliado</Label>
              <Select value={collaboratorId} onValueChange={setCollaboratorId} disabled={!eventId}>
                <SelectTrigger><SelectValue placeholder="Selecione o fiscal" /></SelectTrigger>
                <SelectContent>
                  {links.map((l: any) => (
                    <SelectItem key={l.id} value={l.collaborator_id || l.id}>{l.collaborator_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
