import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageSquareHeart, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const BLOCKS = [
  { key: 'training', label: 'Treinamento recebido' },
  { key: 'organization', label: 'Organização do evento' },
  { key: 'snack', label: 'Lanche / alimentação' },
  { key: 'partner_fiscal', label: 'Avalie o fiscal parceiro (se houver)' },
] as const;

function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(number => (
        <Button
          key={number}
          type="button"
          size="icon"
          variant={value >= number ? 'default' : 'outline'}
          className="h-9 w-9"
          onClick={() => onChange(number)}
          aria-label={`${number} estrela${number > 1 ? 's' : ''}`}
        >
          <Star className={cn('h-3.5 w-3.5', value >= number && 'fill-current')} />
        </Button>
      ))}
    </div>
  );
}

export default function PsPublicSelfEvaluation() {
  const { eventId: routeEventId } = useParams();

  const { data: visibleEvents = [] } = useQuery({
    queryKey: ['ps_public_events', 'self_evaluation'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('ps_public_list_events', { p_surface: 'self_evaluation' });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['ps_public_roles'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('ps_public_list_roles');
      if (error) throw error;
      return data || [];
    },
  });

  const availableRoles = useMemo(
    () => [...roles].sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')),
    [roles]
  );

  const [eventId, setEventId] = useState(routeEventId || '');
  const [identified, setIdentified] = useState(true);
  const [respondentName, setRespondentName] = useState('');
  const [role, setRole] = useState('');
  const [campus, setCampus] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [hadIncident, setHadIncident] = useState(false);
  const [incidentComment, setIncidentComment] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!eventId) return toast.error('Selecione o evento.');
    if (visibleEvents.length > 0 && !visibleEvents.some((event: any) => event.id === eventId)) {
      return toast.error('Este evento não está disponível para autoavaliação.');
    }
    if (identified && !respondentName.trim()) return toast.error('Informe seu nome ou marque como anônimo.');
    if (!role) return toast.error('Selecione o cargo exercido.');
    if (!campus.trim()) return toast.error('Informe o campus.');

    for (const block of BLOCKS) {
      const rating = ratings[block.key];
      if (rating && rating <= 2 && !comments[block.key]?.trim()) {
        return toast.error(`Explique o motivo da nota ${rating} em "${block.label}".`);
      }
    }

    if (hadIncident && !incidentComment.trim()) return toast.error('Descreva a ocorrência antes de enviar.');

    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('ps_public_submit_self_evaluation', {
        p_event_id: eventId,
        p_identified: identified,
        p_respondent_name: identified ? respondentName.trim() : null,
        p_role: role,
        p_campus: campus.trim(),
        p_floor: floor.trim() || null,
        p_room: room.trim() || null,
        p_training_rating: ratings.training || null,
        p_training_comment: comments.training?.trim() || null,
        p_organization_rating: ratings.organization || null,
        p_organization_comment: comments.organization?.trim() || null,
        p_snack_rating: ratings.snack || null,
        p_snack_comment: comments.snack?.trim() || null,
        p_partner_fiscal_rating: ratings.partner_fiscal || null,
        p_partner_fiscal_comment: comments.partner_fiscal?.trim() || null,
        p_had_incident: hadIncident,
        p_incident_comment: hadIncident ? incidentComment.trim() : null,
        p_suggestions: suggestions.trim() || null,
      });

      if (error) throw error;
      if (!data) throw new Error('Não foi possível registrar a autoavaliação.');
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a autoavaliação.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
        <Card className="relative w-full max-w-md border-border/60 bg-card/90 text-center shadow-xl shadow-black/5">
          <CardHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <CardTitle className="pt-2">Resposta enviada</CardTitle>
            <CardDescription>Obrigado pelo seu feedback. Sua resposta foi registrada.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-7 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="relative mx-auto max-w-2xl space-y-5">
        <header className="flex items-start gap-3 border-b border-border/50 pb-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <MessageSquareHeart className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Autoavaliação do Evento</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Conte como foi sua experiência no processo seletivo e ajude a melhorar as próximas edições.</p>
          </div>
        </header>

        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Identificação</CardTitle>
            <CardDescription>Informe seu contexto de atuação no evento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Evento *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {visibleEvents.map((event: any) => <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 p-3">
              <div>
                <p className="text-sm font-medium">Quero me identificar</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Desative para responder anonimamente.</p>
              </div>
              <Switch checked={identified} onCheckedChange={setIdentified} />
            </div>

            {identified && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Seu nome *</Label>
                <Input value={respondentName} onChange={event => setRespondentName(event.target.value)} placeholder="Nome completo" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cargo exercido *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {availableRoles.map((item: any) => <SelectItem key={item.id} value={item.value}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Campus *</Label>
              <Input value={campus} onChange={event => setCampus(event.target.value)} placeholder="Ex.: Campus I" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Andar</Label>
                <Input value={floor} onChange={event => setFloor(event.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sala</Label>
                <Input value={room} onChange={event => setRoom(event.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sua avaliação</CardTitle>
            <CardDescription>Atribua notas e explique avaliações baixas para dar contexto ao feedback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {BLOCKS.map(block => {
              const rating = ratings[block.key] || 0;
              const requiresComment = rating > 0 && rating <= 2;

              return (
                <div key={block.key} className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-medium">{block.label}</span>
                    <Rating value={rating} onChange={value => setRatings({ ...ratings, [block.key]: value })} />
                  </div>

                  {requiresComment && (
                    <p className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                      Para notas 1 ou 2, conte brevemente o motivo.
                    </p>
                  )}

                  <Textarea
                    rows={2}
                    placeholder={requiresComment ? 'Explique o motivo da nota *' : 'Comentário (opcional)'}
                    value={comments[block.key] || ''}
                    onChange={event => setComments({ ...comments, [block.key]: event.target.value })}
                  />
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/10 p-3">
              <div>
                <p className="text-sm font-medium">Houve alguma ocorrência?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Informe qualquer situação relevante durante o evento.</p>
              </div>
              <Switch checked={hadIncident} onCheckedChange={setHadIncident} />
            </div>

            {hadIncident && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descreva a ocorrência *</Label>
                <Textarea rows={3} placeholder="Conte o que aconteceu" value={incidentComment} onChange={event => setIncidentComment(event.target.value)} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sugestões de melhoria</Label>
              <Textarea rows={3} value={suggestions} onChange={event => setSuggestions(event.target.value)} placeholder="Opcional" />
            </div>

            <div className="border-t border-border/50 pt-4">
              <Button className="w-full" onClick={() => void submit()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar resposta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
