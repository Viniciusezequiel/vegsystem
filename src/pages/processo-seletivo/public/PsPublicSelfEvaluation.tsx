import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, CheckCircle2, MessageSquareHeart } from 'lucide-react';
import { usePsEvents, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isSelfEvaluationEnabled } from '@/lib/psPublicFilters.mjs';

const BLOCKS = [
  { key: 'training', label: 'Treinamento recebido' },
  { key: 'organization', label: 'Organização do evento' },
  { key: 'snack', label: 'Lanche / alimentação' },
  { key: 'partner_fiscal', label: 'Fiscal parceiro de sala' },
] as const;

function Rating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button key={n} type="button" size="icon" variant={value >= n ? 'default' : 'outline'} className="h-8 w-8" onClick={() => onChange(n)}>
          <Star className={cn('h-4 w-4', value >= n && 'fill-current')} />
        </Button>
      ))}
    </div>
  );
}

export default function PsPublicSelfEvaluation() {
  const { eventId: routeEventId } = useParams();
  const { data: events = [] } = usePsEvents();
  const { data: roles = [] } = usePsRoles();
  const visibleEvents = useMemo(
    () => events.filter((e: any) => isSelfEvaluationEnabled(e)),
    [events],
  );

  const [eventId, setEventId] = useState(routeEventId || '');
  const [identified, setIdentified] = useState(true);
  const [respondentName, setRespondentName] = useState('');
  const [role, setRole] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [hadIncident, setHadIncident] = useState(false);
  const [incidentComment, setIncidentComment] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!eventId) { toast.error('Selecione o evento.'); return; }
    if (identified && !respondentName.trim()) { toast.error('Informe seu nome ou marque como anônimo.'); return; }
    setSaving(true);
    const { error } = await supabase.from('ps_self_evaluations').insert({
      event_id: eventId,
      identified,
      respondent_name: identified ? respondentName.trim() : null,
      role: role || null,
      training_rating: ratings.training || null,
      training_comment: comments.training || null,
      organization_rating: ratings.organization || null,
      organization_comment: comments.organization || null,
      snack_rating: ratings.snack || null,
      snack_comment: comments.snack || null,
      partner_fiscal_rating: ratings.partner_fiscal || null,
      partner_fiscal_comment: comments.partner_fiscal || null,
      had_incident: hadIncident,
      incident_comment: hadIncident ? incidentComment.trim() || null : null,
      suggestions: suggestions.trim() || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Resposta enviada!</CardTitle>
            <CardDescription>Obrigado pelo seu feedback.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquareHeart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Autoavaliação do Evento</h1>
            <p className="text-muted-foreground">Conte como foi sua experiência no processo seletivo.</p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {visibleEvents.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Quero me identificar</p>
                <p className="text-xs text-muted-foreground">Desative para responder anonimamente.</p>
              </div>
              <Switch checked={identified} onCheckedChange={setIdentified} />
            </div>
            {identified && (
              <div className="space-y-2">
                <Label>Seu nome</Label>
                <Input value={respondentName} onChange={(e) => setRespondentName(e.target.value)} placeholder="Nome completo" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Cargo exercido</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Sua avaliação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {BLOCKS.map((b) => (
              <div key={b.key} className="space-y-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{b.label}</span>
                  <Rating value={ratings[b.key] || 0} onChange={(n) => setRatings({ ...ratings, [b.key]: n })} />
                </div>
                <Textarea
                  rows={2}
                  placeholder="Comentário (opcional)"
                  value={comments[b.key] || ''}
                  onChange={(e) => setComments({ ...comments, [b.key]: e.target.value })}
                />
              </div>
            ))}

            <div className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm font-medium">Houve alguma ocorrência?</span>
              <Switch checked={hadIncident} onCheckedChange={setHadIncident} />
            </div>
            {hadIncident && (
              <Textarea rows={3} placeholder="Descreva a ocorrência" value={incidentComment} onChange={(e) => setIncidentComment(e.target.value)} />
            )}

            <div className="space-y-2">
              <Label>Sugestões de melhoria</Label>
              <Textarea rows={3} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} />
            </div>

            <Button className="w-full" onClick={submit} disabled={saving}>
              {saving ? 'Enviando...' : 'Enviar resposta'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
