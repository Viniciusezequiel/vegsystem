import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function PsV2RecentActivity({ data }: { data: any }) {
  const activities = useMemo(() => {
    const teamByLink = new Map((data?.team || []).map((member: any) => [member.id, member]));
    const result: Array<{ id: string; title: string; detail: string; at: string | null }> = [];
    for (const item of (data?.communications || []).slice(0, 30)) {
      const member: any = teamByLink.get(item.event_collaborator_id);
      result.push({ id: `c-${item.id}`, title: 'Comunicação registrada', detail: `${member?.collaborator_name || 'Fiscal'} · ${item.status || 'sem status'}`, at: item.sent_at || item.failed_at || item.requested_at || null });
    }
    for (const item of data?.trainingChoices || []) {
      const member: any = teamByLink.get(item.event_collaborator_id);
      result.push({ id: `t-${item.id}`, title: 'Treinamento escolhido', detail: member?.collaborator_name || 'Participante', at: item.created_at || null });
    }
    for (const item of data?.evaluations || []) result.push({ id: `e-${item.id}`, title: 'Avaliação registrada', detail: item.final_score != null ? `Nota ${Number(item.final_score).toFixed(1)}` : 'Avaliação concluída', at: item.created_at || null });
    for (const item of data?.selfEvaluations || []) result.push({ id: `s-${item.id}`, title: 'Autoavaliação registrada', detail: 'Resposta recebida', at: item.created_at || null });
    for (const item of data?.assignments || []) {
      const member: any = teamByLink.get(item.event_collaborator_id);
      result.push({ id: `a-${item.id}`, title: 'Função registrada', detail: `${member?.collaborator_name || 'Fiscal'} · ${item.role_name || 'Função'}`, at: item.created_at || null });
    }
    return result.filter((item) => item.at).sort((a, b) => new Date(b.at as string).getTime() - new Date(a.at as string).getTime()).slice(0, 12);
  }, [data]);

  return <Card className="rounded-2xl border-border/60 bg-card/70">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />Atividades recentes</CardTitle><CardDescription>Últimos registros encontrados no evento.</CardDescription></CardHeader>
    <CardContent className="space-y-3">{activities.length ? activities.map((item) => <div key={item.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0"><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p><p className="mt-1 text-[10px] text-muted-foreground/70">{dateTime(item.at)}</p></div>) : <p className="text-xs text-muted-foreground">Nenhuma atividade recente encontrada.</p>}</CardContent>
  </Card>;
}
