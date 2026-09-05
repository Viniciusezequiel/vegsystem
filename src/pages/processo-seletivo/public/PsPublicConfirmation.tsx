import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, UserCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

export default function PsPublicConfirmation() {
  const { eventId, token } = useParams();
  const [record, setRecord] = useState<any>(null);
  const [reason, setReason] = useState('');
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

      const { data, error: rpcError } = await (supabase as any).rpc('ps_public_get_event_collaborator_confirmation', {
        p_event_id: eventId,
        p_token: token,
      });
      if (!active) return;

      if (rpcError || !data?.[0]) {
        setError('Este link de confirmação é inválido.');
      } else {
        setRecord(data[0]);
        if (data[0].token_state === 'expired') {
          setError('Este link de confirmação expirou. Solicite um novo link à organização.');
        }
        if (data[0].token_state === 'used') setDone(data[0].participation_status);
      }
      setLoading(false);
    })();

    return () => { active = false; };
  }, [eventId, token]);

  const respond = async (status: 'confirmed' | 'declined') => {
    if (status === 'declined' && !reason.trim()) {
      setError('Informe brevemente o motivo da recusa.');
      return;
    }

    setSaving(true);
    setError('');
    const { data, error: rpcError } = await (supabase as any).rpc('ps_public_set_event_collaborator_confirmation', {
      p_event_id: eventId,
      p_token: token,
      p_status: status,
      p_decline_reason: status === 'declined' ? reason.trim() : null,
    });
    setSaving(false);

    if (rpcError || !data?.[0]?.success) {
      setError('Não foi possível registrar. O link pode já ter sido utilizado.');
      return;
    }
    setDone(status);
  };

  const doneDescription = done === 'confirmed'
    ? 'Sua participação foi confirmada com sucesso.'
    : done === 'declined'
      ? 'Sua indisponibilidade foi registrada.'
      : 'Confirme sua disponibilidade para o evento.';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <Card className="relative w-full max-w-lg border-border/60 bg-card/90 shadow-xl shadow-black/5 backdrop-blur">
        <CardHeader className="text-center">
          <div className={`mx-auto flex h-13 w-13 items-center justify-center rounded-2xl ${done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
            {done ? <CheckCircle2 className="h-6 w-6" /> : <UserCheck className="h-6 w-6" />}
          </div>
          <CardTitle className="pt-2 text-xl">{done ? 'Resposta registrada' : 'Confirmação de participação'}</CardTitle>
          <CardDescription className="mx-auto max-w-sm leading-relaxed">{doneDescription}</CardDescription>
        </CardHeader>

        {!done && (
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validando link...
              </div>
            )}

            {record && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-semibold">{record.collaborator_name}</p>
                <p className="mt-2 text-sm">{record.event_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(`${record.event_date}T00:00:00`).toLocaleDateString('pt-BR')}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {[record.role_name, record.unit, record.room && `Sala ${record.room}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            )}

            {record?.token_state === 'valid' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="decline-reason" className="text-xs text-muted-foreground">Motivo da recusa</Label>
                  <Textarea
                    id="decline-reason"
                    value={reason}
                    onChange={event => setReason(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Obrigatório somente se você não puder participar"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={() => void respond('confirmed')} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar participação
                  </Button>
                  <Button variant="outline" onClick={() => void respond('declined')} disabled={saving}>
                    Não poderei participar
                  </Button>
                </div>
              </>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </main>
  );
}
