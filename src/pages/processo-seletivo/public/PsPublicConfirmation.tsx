import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Loader2, MapPin, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

type TrainingChoiceMap = Record<string, string>;

const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  : '';

export default function PsPublicConfirmation() {
  const { eventId, token } = useParams();
  const [record, setRecord] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [trainingChoices, setTrainingChoices] = useState<TrainingChoiceMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!eventId || !token) {
        setError('Link de confirmação inválido.');
        setLoading(false);
        return;
      }
      const { data, error: rpcError } = await (supabase as any).rpc('ps_public_get_event_collaborator_confirmation_v2', { p_event_id: eventId, p_token: token });
      if (!active) return;
      if (rpcError || !data) {
        setError('Este link de confirmação é inválido.');
      } else {
        setRecord(data);
        const initialChoices: TrainingChoiceMap = {};
        for (const group of data.training_groups || []) {
          if (group.selected_session_id && (group.options || []).some((option: any) => option.id === group.selected_session_id)) initialChoices[group.id] = group.selected_session_id;
        }
        setTrainingChoices(initialChoices);
        if (data.token_state === 'expired') setError('Este link de confirmação expirou. Solicite um novo link à organização.');
        if (data.token_state === 'used') setDone(data.participation_status);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [eventId, token]);

  const requiredTrainingGroups = useMemo(() => (record?.training_groups || []).filter((group: any) => group.required), [record]);
  const missingTraining = requiredTrainingGroups.some((group: any) => !trainingChoices[group.id]);

  const respond = async (status: 'confirmed' | 'declined') => {
    if (status === 'declined' && !reason.trim()) { setError('Informe brevemente o motivo da recusa.'); return; }
    if (status === 'confirmed' && missingTraining) { setError('Escolha uma data para cada treinamento obrigatório antes de confirmar.'); return; }
    setSaving(true); setError('');
    const choices = Object.entries(trainingChoices).map(([training_group_id, training_session_id]) => ({ training_group_id, training_session_id }));
    const { data, error: rpcError } = await (supabase as any).rpc('ps_public_set_event_collaborator_confirmation_v2', {
      p_event_id: eventId,
      p_token: token,
      p_status: status,
      p_decline_reason: status === 'declined' ? reason.trim() : null,
      p_training_choices: status === 'confirmed' ? choices : [],
    });
    setSaving(false);
    if (rpcError || !data?.[0]?.success) {
      const message = String(rpcError?.message || '');
      if (message.includes('training_session_full')) setError('Uma das turmas escolhidas acabou de atingir o limite de vagas. Escolha outra opção.');
      else if (message.includes('training_selection_required')) setError('Selecione uma data válida para todos os treinamentos obrigatórios.');
      else setError('Não foi possível registrar. O link pode já ter sido utilizado ou expirado.');
      return;
    }
    setDone(status);
  };

  const doneDescription = done === 'confirmed' ? 'Sua participação foi confirmada com sucesso.' : done === 'declined' ? 'Sua indisponibilidade foi registrada.' : 'Confirme sua disponibilidade para o evento.';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
      <Card className="relative w-full max-w-2xl border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <CardHeader className="text-center">
          <div className={`mx-auto flex h-13 w-13 items-center justify-center rounded-2xl ${done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{done ? <CheckCircle2 className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}</div>
          <CardTitle className="pt-2 text-xl">{done ? 'Resposta registrada' : 'Confirmação de participação'}</CardTitle>
          <CardDescription className="mx-auto max-w-lg leading-relaxed">{doneDescription}</CardDescription>
        </CardHeader>

        {!done && <CardContent className="space-y-5">
          {loading && <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validando link...</div>}

          {record && <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-semibold">{record.collaborator_name}</p><p className="mt-2 text-sm">{record.event_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{record.event_date ? new Date(`${record.event_date}T00:00:00`).toLocaleDateString('pt-BR') : 'Data não informada'}</p>
            <p className="mt-2 text-xs text-muted-foreground">{[record.unit, record.room && `Sala ${record.room}`].filter(Boolean).join(' · ')}</p>
            {(record.assignments || []).length > 0 && <div className="mt-4 border-t border-border/50 pt-3"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sua atuação</p><div className="mt-2 space-y-2">{record.assignments.map((assignment: any) => <div key={assignment.id} className="rounded-lg bg-background/60 px-3 py-2 text-xs"><span>{assignment.role_name}{assignment.journey_key ? ` · ${assignment.journey_key === 'integral' ? 'Integral' : assignment.journey_key}` : ''}</span></div>)}</div></div>}
          </div>}

          {record?.token_state === 'valid' && (record.training_groups || []).length > 0 && <section className="space-y-3">
            <div><h2 className="text-sm font-semibold">Escolha do treinamento</h2><p className="mt-1 text-xs text-muted-foreground">As opções abaixo são exibidas conforme os cargos da sua escala.</p></div>
            {(record.training_groups || []).map((group: any) => <div key={group.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{group.name}</p>{group.description && <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>}</div><Badge variant={group.required ? 'default' : 'secondary'}>{group.required ? 'Obrigatório' : 'Opcional'}</Badge></div>
              <div className="mt-3 space-y-2">{(group.options || []).map((option: any) => {
                const selected = trainingChoices[group.id] === option.id;
                return <button key={option.id} type="button" disabled={!option.available && !selected} onClick={() => setTrainingChoices(current => ({ ...current, [group.id]: option.id }))} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/60 bg-muted/10 hover:border-primary/40'} ${!option.available && !selected ? 'cursor-not-allowed opacity-50' : ''}`}><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4 text-primary" />{dateTime(option.starts_at)}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{[option.campus, option.location, option.room && `Sala ${option.room}`].filter(Boolean).join(' · ')}</p></div><div className="text-right text-[11px] text-muted-foreground">{option.capacity ? <span>{option.selected_count}/{option.capacity} vagas</span> : <span>Sem limite</span>}{!option.available && <Badge variant="secondary" className="ml-2">Lotado</Badge>}</div></div></button>;
              })}{(group.options || []).length === 0 && <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">Ainda não há datas disponíveis para este treinamento. Entre em contato com a organização.</div>}</div>
            </div>)}
          </section>}

          {record?.token_state === 'valid' && <><div className="space-y-1.5"><Label htmlFor="decline-reason" className="text-xs text-muted-foreground">Motivo da recusa</Label><Textarea id="decline-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Obrigatório somente se você não puder participar" /></div><div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => void respond('confirmed')} disabled={saving || missingTraining}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar participação</Button><Button variant="outline" onClick={() => void respond('declined')} disabled={saving}>Não poderei participar</Button></div></>}
          {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
        </CardContent>}
      </Card>
    </main>
  );
}
