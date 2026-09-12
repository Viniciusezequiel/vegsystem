import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Level = 'critical' | 'warning' | 'info';
type Issue = { level: Level; label: string };
const weight: Record<Level, number> = { critical: 3, warning: 2, info: 1 };
const tone: Record<Level, string> = {
  critical: 'border-destructive/25 bg-destructive/[0.06] text-destructive',
  warning: 'border-amber-500/25 bg-amber-500/[0.07] text-amber-600',
  info: 'border-primary/20 bg-primary/[0.05] text-primary',
};
const started = (date?: string | null) => !!date && Date.now() >= new Date(`${date}T23:59:59`).getTime();

export function PsV2PendingPeople({ team, communications, eventDate }: { team: any[]; communications: any[]; eventDate?: string | null }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('pending');
  const latestByLink = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of communications || []) if (item.event_collaborator_id && !map.has(item.event_collaborator_id)) map.set(item.event_collaborator_id, item);
    return map;
  }, [communications]);

  const rows = useMemo(() => (team || []).map((member: any) => {
    const issues: Issue[] = [];
    const status = member.participation_status || 'pending_confirmation';
    const replaced = status === 'replaced';
    const declined = status === 'declined';
    const latest = latestByLink.get(member.id);
    if (!replaced && !member.email) issues.push({ level: 'critical', label: 'Sem e-mail' });
    if (declined) issues.push({ level: 'critical', label: 'Recusou participação' });
    else if (!replaced && status === 'pending_confirmation') issues.push({ level: 'warning', label: 'Confirmação pendente' });
    if (!replaced && latest && ['failed', 'failed_missing_recipient'].includes(latest.status)) issues.push({ level: 'critical', label: 'Falha de comunicação' });
    if (member.absent) issues.push({ level: 'info', label: 'Ausência registrada' });
    else if (started(eventDate) && !replaced && !declined && !member.present && !member.signed_at) issues.push({ level: 'warning', label: 'Presença pendente' });
    if (started(eventDate) && (member.present || member.signed_at) && !member.evaluated) issues.push({ level: 'info', label: 'Avaliação pendente' });
    return { member, issues, highest: issues.reduce((n, issue) => Math.max(n, weight[issue.level]), 0) };
  }).sort((a: any, b: any) => b.highest - a.highest || String(a.member.collaborator_name || '').localeCompare(String(b.member.collaborator_name || ''), 'pt-BR')), [team, latestByLink, eventDate]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR');
    return rows.filter((row: any) => {
      if (filter === 'pending' && !row.issues.length) return false;
      if (filter === 'critical' && !row.issues.some((issue: Issue) => issue.level === 'critical')) return false;
      if (filter === 'clear' && row.issues.length) return false;
      if (!needle) return true;
      return [row.member.collaborator_name, row.member.assigned_role, row.member.role_name, row.member.unit, row.member.floor, row.member.room]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase('pt-BR').includes(needle));
    });
  }, [rows, search, filter]);

  const pending = rows.filter((row: any) => row.issues.length).length;
  const critical = rows.filter((row: any) => row.issues.some((issue: Issue) => issue.level === 'critical')).length;
  const clear = Math.max(0, rows.length - pending);

  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pessoas analisadas</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></CardContent></Card>
      <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.04]"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com pendências</p><p className="mt-1 text-2xl font-semibold">{pending}</p></CardContent></Card>
      <Card className="rounded-2xl border-destructive/20 bg-destructive/[0.04]"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Críticas</p><p className="mt-1 text-2xl font-semibold">{critical}</p></CardContent></Card>
      <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/[0.04]"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem alerta individual</p><p className="mt-1 text-2xl font-semibold">{clear}</p></CardContent></Card>
    </section>

    <Card className="rounded-2xl border-border/60 bg-card/70">
      <CardHeader className="pb-3"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><CardTitle className="text-base">Pendências por pessoa</CardTitle><CardDescription className="mt-1">Confirmação, comunicação, presença e avaliação em uma única leitura.</CardDescription></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pessoa..." className="pl-9" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Com pendências</SelectItem><SelectItem value="critical">Somente críticas</SelectItem><SelectItem value="clear">Sem pendências</SelectItem><SelectItem value="all">Todas as pessoas</SelectItem></SelectContent></Select></div></div></CardHeader>
      <CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Função / local</TableHead><TableHead>Status</TableHead><TableHead>Pendências</TableHead></TableRow></TableHeader><TableBody>{filtered.map((row: any) => <TableRow key={row.member.id}><TableCell className="font-medium">{row.member.collaborator_name}</TableCell><TableCell><p className="text-sm">{row.member.assigned_role || row.member.role_name || 'Sem função'}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{[row.member.unit, row.member.floor, row.member.room].filter(Boolean).join(' · ') || 'Local não informado'}</p></TableCell><TableCell><Badge variant="outline">{row.member.participation_status || 'pending_confirmation'}</Badge></TableCell><TableCell>{row.issues.length ? <div className="flex max-w-xl flex-wrap gap-1.5">{row.issues.map((issue: Issue) => <Badge key={`${row.member.id}-${issue.label}`} variant="outline" className={tone[issue.level]}>{issue.label}</Badge>)}</div> : <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-4 w-4" />Sem alerta individual</span>}</TableCell></TableRow>)}</TableBody></Table></div>{!filtered.length && <div className="p-8 text-center"><Users className="mx-auto h-8 w-8 text-muted-foreground/40" /><p className="mt-2 text-sm text-muted-foreground">Nenhuma pessoa corresponde aos filtros.</p></div>}</CardContent>
    </Card>

    {critical > 0 && <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.04] p-3 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>Itens críticos são apenas sinalizados aqui. A correção continua sendo feita no módulo oficial enquanto o V2 estiver em modo seguro.</span></div>}
  </div>;
}
