import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { PenLine, CheckCircle2, Search } from 'lucide-react';
import { usePsEvents } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { submitPublicProcessSelectionSignature } from '@/lib/signatureStorage';

export default function PsPublicAttendance() {
  const { eventId: routeEventId } = useParams();
  const { data: events = [] } = usePsEvents();
  const [eventId, setEventId] = useState(routeEventId || '');

  const { data: links = [], refetch } = useQuery({
    queryKey: ['ps_public_roster', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ps_public_event_roster', { p_event_id: eventId });
      if (error) throw error;
      return data || [];
    },
  });

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const filtered = useMemo(
    () => links.filter((l: any) => l.collaborator_name?.toLowerCase().includes(search.toLowerCase())),
    [links, search],
  );
  const selected = links.find((l: any) => l.id === selectedId);

  const submit = async () => {
    if (!selected) { toast.error('Selecione seu nome na lista.'); return; }
    if (!signature) { toast.error('Assine no campo indicado.'); return; }
    setSaving(true);
    try {
      await submitPublicProcessSelectionSignature(selected.id, signature);
      await refetch();
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a assinatura.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md rounded-2xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <CardTitle>Presença registrada!</CardTitle>
            <CardDescription>Assinatura de {selected?.collaborator_name} confirmada.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => { setDone(false); setSelectedId(''); setSignature(null); setSearch(''); }}>
              Registrar outra presença
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
            <PenLine className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Lista de Presença</h1>
            <p className="text-muted-foreground">Localize seu nome e assine digitalmente.</p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setSelectedId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>
                  {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar seu nome..." value={search} onChange={(e) => setSearch(e.target.value)} disabled={!eventId} />
            </div>

            <div className="max-h-72 divide-y overflow-y-auto rounded-xl border">
              {filtered.map((l: any) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`flex w-full items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50 ${selectedId === l.id ? 'bg-primary/10' : ''}`}
                >
                  <span>
                    <span className="font-medium">{l.collaborator_name}</span>
                    {l.assigned_role && <span className="block text-xs text-muted-foreground">{l.assigned_role}</span>}
                  </span>
                  {l.signed_at ? <Badge variant="secondary">Assinado</Badge> : null}
                </button>
              ))}
              {eventId && filtered.length === 0 && <p className="p-3 text-sm text-muted-foreground">Nenhum fiscal encontrado.</p>}
              {!eventId && <p className="p-3 text-sm text-muted-foreground">Selecione um evento.</p>}
            </div>
          </CardContent>
        </Card>

        {selected && (
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Assinatura de {selected.collaborator_name}</CardTitle>
              <CardDescription>Assine usando o dedo ou o mouse.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignaturePad onSignatureChange={setSignature} />
              <Button className="w-full" onClick={submit} disabled={saving}>
                {saving ? 'Registrando...' : 'Confirmar presença'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
