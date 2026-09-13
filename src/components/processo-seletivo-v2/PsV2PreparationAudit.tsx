import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, MapPinned } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Props = { candidates: any[] };
const value = (input: unknown) => String(input ?? '').trim();

export function PsV2PreparationAudit({ candidates }: Props) {
  const audit = useMemo(() => {
    const rooms = new Map<string, { label: string; total: number; pcd: number; missingSeat: number }>();
    const seats = new Map<string, number>();
    let missingRegistration = 0;
    let missingRoom = 0;
    let missingSeat = 0;

    for (const candidate of candidates) {
      const campus = value(candidate.campus) || 'Sem campus';
      const room = value(candidate.room);
      const seat = value(candidate.seat_number || candidate.seat);
      if (!value(candidate.registration_number)) missingRegistration += 1;
      if (!room) missingRoom += 1;
      if (!seat) missingSeat += 1;
      const roomKey = `${campus}|${room || 'Sem sala'}`.toLocaleLowerCase('pt-BR');
      const current = rooms.get(roomKey) || { label: `${campus} · ${room || 'Sem sala'}`, total: 0, pcd: 0, missingSeat: 0 };
      current.total += 1;
      if (value(candidate.pcd_type)) current.pcd += 1;
      if (!seat) current.missingSeat += 1;
      rooms.set(roomKey, current);
      if (room && seat) {
        const seatKey = `${campus}|${room}|${seat}`.toLocaleLowerCase('pt-BR');
        seats.set(seatKey, (seats.get(seatKey) || 0) + 1);
      }
    }

    const duplicateSeats = [...seats.values()].filter((count) => count > 1).length;
    const checks = [
      { label: 'Inscrição', ok: missingRegistration === 0, value: missingRegistration },
      { label: 'Sala', ok: missingRoom === 0, value: missingRoom },
      { label: 'Assento', ok: missingSeat === 0, value: missingSeat },
      { label: 'Duplicidades', ok: duplicateSeats === 0, value: duplicateSeats },
    ];
    return { checks, rooms: [...rooms.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true })) };
  }, [candidates]);

  const ok = audit.checks.filter((item) => item.ok).length;
  const ready = candidates.length > 0 && ok === audit.checks.length;

  return (
    <div className="space-y-4">
      <Card className={`rounded-2xl ${ready ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-amber-500/25 bg-amber-500/[0.04]'}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Conferência pré-impressão</CardTitle>
              <CardDescription>Validação somente leitura dos dados usados nas etiquetas.</CardDescription>
            </div>
            <Badge variant={ready ? 'default' : 'secondary'}>{candidates.length ? `${ok}/4 critérios OK` : 'Sem candidatos'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {audit.checks.map((item) => (
            <div key={item.label} className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{item.label}</span>
                {item.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.ok ? 'Sem pendências.' : `${item.value} ocorrência(s).`}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-4 w-4 text-primary" />Distribuição por sala</CardTitle>
          <CardDescription>{audit.rooms.length} ambiente(s) identificado(s).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[340px] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Campus / sala</TableHead><TableHead className="text-right">Candidatos</TableHead><TableHead className="text-right">PCD</TableHead><TableHead className="text-right">Sem assento</TableHead></TableRow></TableHeader>
              <TableBody>{audit.rooms.map((room) => <TableRow key={room.label}><TableCell className="font-medium">{room.label}</TableCell><TableCell className="text-right">{room.total}</TableCell><TableCell className="text-right">{room.pcd}</TableCell><TableCell className="text-right">{room.missingSeat || '—'}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          {!audit.rooms.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma sala identificada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
