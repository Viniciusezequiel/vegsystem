import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Database, Download, ExternalLink, FileCheck2, ShieldCheck, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePsCandidates, usePsEvent } from '@/hooks/useProcessoSeletivo';
import { usePsV2AllocationReview } from '@/hooks/usePsV2AllocationReview';
import { usePsV2EventReadOnly } from '@/hooks/usePsV2EventReadOnly';
import { usePsV2EventStaffing } from '@/hooks/usePsV2EventStaffing';
import { buildPsV2IntegrationAudit, type PsV2AuditFinding } from '@/lib/psV2IntegrationAudit';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';
import { PS_V2_OFFICIAL_WRITES_ENABLED } from '@/lib/psV2Safety';

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function Finding({ finding }: { finding: PsV2AuditFinding }) {
  const isBlocker = finding.severity === 'blocker';
  const isWarning = finding.severity === 'warning';
  const Icon = isBlocker ? Ban : isWarning ? AlertTriangle : CheckCircle2;
  const tone = isBlocker
    ? 'border-destructive/25 bg-destructive/[0.05]'
    : isWarning
      ? 'border-amber-500/25 bg-amber-500/[0.05]'
      : 'border-emerald-500/20 bg-emerald-500/[0.04]';
  const iconTone = isBlocker ? 'text-destructive' : isWarning ? 'text-amber-500' : 'text-emerald-500';

  return <div className={`flex gap-3 rounded-xl border p-3 ${tone}`}>
    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} />
    <div className="min-w-0"><p className="text-xs font-semibold">{finding.title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{finding.detail}</p></div>
  </div>;
}

export default function PsV2IntegrationDryRun() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const { data: candidates = [], isLoading: candidatesLoading } = usePsCandidates(eventId);
  const readOnly = usePsV2EventReadOnly(eventId);
  const staffing = usePsV2EventStaffing(eventId);
  const review = usePsV2AllocationReview(eventId);
  const base = `${PS_V2_BASE_PATH}/eventos/${eventId}/equipe`;

  const data = readOnly.data;
  const requirements = staffing.data?.requirements || [];
  const items = review.data?.items || [];
  const run = review.data?.run || null;

  const audit = useMemo(() => buildPsV2IntegrationAudit({
    event,
    candidates: candidates as any[],
    team: data?.team || [],
    metrics: data?.metrics,
    requirements,
    run,
    items,
    staffingSchemaReady: staffing.data?.schemaReady,
    reviewSchemaReady: review.data?.schemaReady,
    trainingGroups: data?.trainingGroups || [],
    trainingSessions: data?.trainingSessions || [],
  }), [candidates, data, event, items, requirements, review.data?.schemaReady, run, staffing.data?.schemaReady]);

  const officialIds = useMemo(() => new Set((data?.team || []).map((member: any) => String(member?.collaborator_id || '')).filter(Boolean)), [data?.team]);
  const requirementById = useMemo(() => new Map(requirements.map((item: any) => [String(item.id), item])), [requirements]);
  const accepted = useMemo(() => items.filter((item: any) => item.status === 'accepted'), [items]);

  const exportDryRun = () => {
    const header = ['Ação simulada', 'Colaborador', 'ID colaborador', 'Função planejada', 'Status revisão', 'Score'];
    const rows = accepted.map((item: any) => {
      const collaboratorId = String(item.collaborator_id || '');
      const requirement: any = requirementById.get(String(item.requirement_id));
      return [
        officialIds.has(collaboratorId) ? 'PRESERVAR - já existe na equipe oficial' : 'ADICIONAR - somente em futura integração',
        item.score_breakdown?.collaborator_name || 'Colaborador vinculado',
        collaboratorId,
        requirement?.role_name_snapshot || '',
        item.status || '',
        Number(item.score || 0).toFixed(1),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dry-run-integracao-${String(event?.name || 'evento').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'evento'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (eventLoading || candidatesLoading || readOnly.isLoading || staffing.isLoading || review.isLoading) {
    return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Executando conferência pré-integração...</div></MainLayout>;
  }

  if (!event) return <MainLayout><div className="p-10 text-center text-sm">Evento não encontrado.</div></MainLayout>;

  const p = audit.preview;
  const statusLabel = audit.canTechnicallyIntegrate ? 'Tecnicamente pronto' : 'Ainda possui bloqueios';

  return <MainLayout>
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link to={PS_V2_BASE_PATH} className="hover:text-foreground">Processo Seletivo 2</Link><span>/</span>
      <Link to={`${base}?view=overview`} className="hover:text-foreground">{event.name}</Link><span>/</span><span className="text-foreground">Pré-integração</span>
    </div>

    <PageHeader
      title="Pré-integração · dry-run"
      description={`${event.name} · simulação e auditoria sem qualquer escrita no módulo oficial`}
      actions={<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={exportDryRun} disabled={!accepted.length}><Download className="mr-2 h-4 w-4" />Exportar simulação</Button><Button asChild variant="outline" size="sm"><Link to={`${base}?view=overview`}><ArrowLeft className="mr-2 h-4 w-4" />Central do evento</Link></Button></div>}
    />

    <Card className="mb-5 rounded-2xl border-emerald-500/25 bg-emerald-500/[0.05]">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Barreira de segurança ativa</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Esta tela somente lê dados, calcula diferenças e exporta uma simulação local. Publicação de equipe, comunicação, presença, avaliações, pagamentos e encerramento continuam bloqueados no V2.</p></div>
        <Badge variant="outline" className="w-fit border-emerald-500/30 text-emerald-500">Escritas oficiais: {PS_V2_OFFICIAL_WRITES_ENABLED ? 'ativadas' : 'bloqueadas'}</Badge>
      </CardContent>
    </Card>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {[
        ['Equipe oficial preservada', p.officialPreserved, 'nenhum vínculo removido', Users],
        ['Aceitos no V2', p.accepted, `${p.reviewedItems}/${p.totalItems} itens revisados`, FileCheck2],
        ['Já estão na equipe', p.alreadyOfficial, 'seriam preservados', CheckCircle2],
        ['Entrariam futuramente', p.wouldInsert, 'nenhuma inserção agora', Database],
        ['Bloqueios', audit.blockers.length, statusLabel, Ban],
        ['Alertas', audit.warnings.length, 'não impedem o dry-run', AlertTriangle],
      ].map(([label, value, detail, Icon]: any) => <Card key={label} className="rounded-2xl border-border/60 bg-card/70"><CardContent className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1.5 text-2xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div><Icon className="h-5 w-5 shrink-0 text-primary" /></CardContent></Card>)}
    </section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="rounded-2xl border-border/60 bg-card/70">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-base">Resultado da simulação</CardTitle><CardDescription>O que aconteceria se, no futuro, a proposta revisada fosse publicada.</CardDescription></div><Badge variant={audit.canTechnicallyIntegrate ? 'default' : 'secondary'}>{statusLabel}</Badge></div></CardHeader>
          <CardContent className="p-0">
            {!accepted.length ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma alocação aceita para simular.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Resultado futuro</TableHead><TableHead>Colaborador</TableHead><TableHead>Função</TableHead><TableHead className="w-24">Score</TableHead></TableRow></TableHeader><TableBody>{accepted.map((item: any) => {
              const collaboratorId = String(item.collaborator_id || '');
              const requirement: any = requirementById.get(String(item.requirement_id));
              const alreadyOfficial = officialIds.has(collaboratorId);
              return <TableRow key={item.id}><TableCell><Badge variant="outline" className={alreadyOfficial ? 'border-emerald-500/30 text-emerald-500' : 'border-primary/30 text-primary'}>{alreadyOfficial ? 'Preservar' : 'Adicionar futuramente'}</Badge></TableCell><TableCell><p className="text-sm font-medium">{item.score_breakdown?.collaborator_name || 'Colaborador vinculado'}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{collaboratorId || 'sem id'}</p></TableCell><TableCell className="text-sm">{requirement?.role_name_snapshot || 'Função não localizada'}</TableCell><TableCell className="font-mono text-xs">{Number(item.score || 0).toFixed(1)}</TableCell></TableRow>;
            })}</TableBody></Table></div>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader><CardTitle className="text-base">Conferências aprovadas</CardTitle><CardDescription>Validações que já passaram no estado atual.</CardDescription></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{audit.checks.length ? audit.checks.map((finding) => <Finding key={finding.code} finding={finding} />) : <p className="text-sm text-muted-foreground">Nenhuma conferência concluída ainda.</p>}</CardContent></Card>
      </div>

      <aside className="space-y-4">
        <Card className="rounded-2xl border-destructive/20 bg-destructive/[0.03]"><CardHeader className="pb-3"><CardTitle className="text-sm">Bloqueios técnicos</CardTitle><CardDescription>Precisariam estar zerados antes de uma futura virada.</CardDescription></CardHeader><CardContent className="space-y-2">{audit.blockers.length ? audit.blockers.map((finding) => <Finding key={finding.code} finding={finding} />) : <Finding finding={{ code: 'no-blockers', severity: 'ok', title: 'Nenhum bloqueio técnico encontrado', detail: 'A proposta passou nas verificações locais. A escrita oficial continua bloqueada por política de segurança.' }} />}</CardContent></Card>

        <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.03]"><CardHeader className="pb-3"><CardTitle className="text-sm">Alertas de qualidade</CardTitle><CardDescription>Dados que merecem revisão antes da migração definitiva.</CardDescription></CardHeader><CardContent className="space-y-2">{audit.warnings.length ? audit.warnings.map((finding) => <Finding key={finding.code} finding={finding} />) : <p className="text-xs text-muted-foreground">Nenhum alerta de qualidade detectado.</p>}</CardContent></Card>

        <Card className="rounded-2xl border-border/60 bg-card/70"><CardContent className="space-y-3 p-4"><p className="text-xs font-semibold">Próximo limite seguro</p><p className="text-[11px] leading-relaxed text-muted-foreground">Depois que esta tela estiver sem bloqueios, o próximo passo já seria ativar escrita compartilhada e migrations de integração. Essa etapa permanece fora do escopo enquanto o módulo atual estiver em uso.</p><Button asChild variant="outline" size="sm" className="w-full"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Conferir módulo oficial <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button></CardContent></Card>
      </aside>
    </div>
  </MainLayout>;
}
