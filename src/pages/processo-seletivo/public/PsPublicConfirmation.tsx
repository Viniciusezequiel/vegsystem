import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, UserCheck } from 'lucide-react';
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
      if (!eventId || !token) { setError('Link de confirmação inválido.'); setLoading(false); return; }
      const { data, error: rpcError } = await (supabase as any).rpc('ps_public_get_event_collaborator_confirmation', {
        p_event_id: eventId, p_token: token,
      });
      if (!active) return;
      if (rpcError || !data?.[0]) setError('Este link de confirmação é inválido.');
      else {
        setRecord(data[0]);
        if (data[0].token_state === 'expired') setError('Este link de confirmação expirou. Solicite um novo link à organização.');
        if (data[0].token_state === 'used') setDone(data[0].participation_status);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [eventId, token]);

  const respond = async (status: 'confirmed' | 'declined') => {
    if (status === 'declined' && !reason.trim()) { setError('Informe brevemente o motivo da recusa.'); return; }
    setSaving(true); setError('');
    const { data, error: rpcError } = await (supabase as any).rpc('ps_public_set_event_collaborator_confirmation', {
      p_event_id: eventId, p_token: token, p_status: status, p_decline_reason: status === 'declined' ? reason.trim() : null,
    });
    setSaving(false);
    if (rpcError || !data?.[0]?.success) { setError('Não foi possível registrar. O link pode já ter sido utilizado.'); return; }
    setDone(status);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg rounded-2xl">
        <CardHeader className="text-center">
          {done ? <CheckCircle2 className="mx-auto h-12 w-12 text-primary" /> : <UserCheck className="mx-auto h-10 w-10 text-primary" />}
          <CardTitle>{done ? 'Resposta registrada' : 'Confirmação de participação'}</CardTitle>
          <CardDescription>{done === 'confirmed' ? 'Sua participação foi confirmada.' : done === 'declined' ? 'Sua recusa foi registrada.' : 'Confirme sua disponibilidade para o evento.'}</CardDescription>
        </CardHeader>
        {!done && <CardContent className="space-y-4">
          {loading && <p className="text-center text-sm text-muted-foreground">Validando link...</p>}
          {record && <div className="rounded-xl border p-4 text-sm">
            <p className="font-semibold">{record.collaborator_name}</p>
            <p>{record.event_name} · {new Date(`${record.event_date}T00:00:00`).toLocaleDateString('pt-BR')}</p>
            <p className="text-muted-foreground">{[record.role_name, record.unit, record.room && `Sala ${record.room}`].filter(Boolean).join(' · ')}</p>
          </div>}
          {record?.token_state === 'valid' && <><div className="space-y-2"><Label htmlFor="decline-reason">Motivo da recusa (obrigatório ao recusar)</Label><Textarea id="decline-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></div>
          <div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => respond('confirmed')} disabled={saving}>Confirmar participação</Button><Button variant="outline" onClick={() => respond('declined')} disabled={saving}>Não poderei participar</Button></div></>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>}
      </Card>
    </main>
  );
}
