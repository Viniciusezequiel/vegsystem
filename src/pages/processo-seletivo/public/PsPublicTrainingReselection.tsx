import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Loader2, MapPin, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
  : '';

export default function PsPublicTrainingReselection() {
  const { eventId, token } = useParams();
  const [record, setRecord] = useState<any>(null);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      if (!eventId || !token) {
        setError('Link de escolha inválido.');
        setLoading(false);
        return;
      }
      const { data, error: rpcError } = await (supabase as any).rpc('ps_public_get_training_reselection', {
        p_event_id: eventId,
        p_token: token,
      });
      if (!active) return;
      if (rpcError || !data) setError('Este link de escolha é inválido.');
      else {
        setRecord(data);
        if (data.token_state === 'expired') setError('Este link expirou. Solicite um novo link à organização.');
        else if (data.token_state === 'used') setDone(true);
        else if (data.token_state !== 'valid') setError('Este link não está mais disponível.');
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [eventId, token]);

  const submit = async () => {
    if (!selectedSessionId) {
      setError('Escolha uma nova data de treinamento.');
      return;
    }
    setSaving(true);
    setError('');
    const { data, error: rpcError } = await (supabase as any).rpc('ps_public_set_training_reselection', {
      p_event_id: eventId,
      p_token: token,
      p_training_session_id: selectedSessionId,
    });
    setSaving(false);
    if (rpcError || !data?.[0]?.success) {
      const message = String(rpcError?.message || '');
      if (message.includes('training_session_full')) setError('Esta turma acabou de atingir o limite de vagas. Escolha outra opção.');
      else setError('Não foi possível registrar a escolha. O link pode ter expirado ou já ter sido utilizado.');
      return;
    }
    setDone(true);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
      <Card className="relative w-full max-w-2xl border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <CardHeader className="text-center">
          <div className={`mx-auto flex h-13 w-13 items-center justify-center rounded-2xl ${done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
            {done ? <CheckCircle2 className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
          </div>
          <CardTitle className="pt-2 text-xl">{done ? 'Nova data registrada' : 'Escolha uma nova data de treinamento'}</CardTitle>
          <CardDescription>{done ? 'Sua nova data de treinamento foi confirmada com sucesso.' : 'A data escolhida anteriormente foi cancelada pela organização.'}</CardDescription>
        </CardHeader>

        {!done && <CardContent className="space-y-5">
          {loading && <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validando link...</div>}

          {record && <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-semibold">{record.collaborator_name}</p>
            <p className="mt-1 text-sm">{record.event_name}</p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Treinamento</p>
            <p className="mt-1 text-sm font-medium">{record.training_group_name}</p>
            {record.cancelled_session && <p className="mt-2 text-xs text-muted-foreground">Data cancelada: {dateTime(record.cancelled_session.starts_at)} · {[record.cancelled_session.campus, record.cancelled_session.location, record.cancelled_session.room && `Sala ${record.cancelled_session.room}`].filter(Boolean).join(' · ')}</p>}
            {record.reason && <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"><strong>Motivo:</strong> {record.reason}</p>}
          </div>}

          {record?.token_state === 'valid' && <section className="space-y-3">
            <div><h2 className="text-sm font-semibold">Datas disponíveis</h2><p className="mt-1 text-xs text-muted-foreground">Escolha uma das opções abaixo para concluir a remarcação.</p></div>
            <div className="space-y-2">{(record.options || []).map((option: any) => {
              const selected = selectedSessionId === option.id;
              return <button
                key={option.id}
                type="button"
                disabled={!option.available}
                onClick={() => setSelectedSessionId(option.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border/60 bg-muted/10 hover:border-primary/40'} ${!option.available ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div><p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4 text-primary" />{dateTime(option.starts_at)}</p><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{[option.campus, option.location, option.room && `Sala ${option.room}`].filter(Boolean).join(' · ')}</p></div>
                  <div className="text-right text-[11px] text-muted-foreground">{option.capacity ? <span>{option.selected_count}/{option.capacity} vagas</span> : <span>Sem limite</span>}{!option.available && <Badge variant="secondary" className="ml-2">Lotado</Badge>}</div>
                </div>
              </button>;
            })}</div>
            {!(record.options || []).length && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">Não há outra data disponível. Entre em contato com a organização.</div>}
            <Button className="w-full" disabled={!selectedSessionId || saving} onClick={() => void submit()}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar nova data</Button>
          </section>}

          {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
        </CardContent>}
      </Card>
    </main>
  );
}
