import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Lock,
  LockOpen,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PsV2CandidateDialog } from '@/components/processo-seletivo-v2/PsV2CandidateDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  usePsCollaboratorParticipations,
  usePsCollaborators,
  usePsEvent,
  usePsEventCollaborators,
  usePsEventConfirmationSummary,
} from '@/hooks/useProcessoSeletivo';
import { usePsV2AllocationReview, usePsV2AllocationReviewMutations } from '@/hooks/usePsV2AllocationReview';
import { usePsV2Eligibility } from '@/hooks/usePsV2Eligibility';
import { usePsV2EventStaffing } from '@/hooks/usePsV2EventStaffing';
import { buildPsV2AllocationPlan, type PsV2RankedCandidate } from '@/lib/psV2AllocationEngine';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data definida';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
};

const normalizeText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim();

const looselyMatches = (left: unknown, right: unknown) => {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};

const scopeLabels: Record<string, string> = {
  location: 'Local',
  building: 'Prédio',
  floor: 'Andar',
  area: 'Área',
  environment: 'Ambiente',
};

const reviewStatus = (status?: string | null) => {
  if (status === 'accepted') return { label: 'Aceito', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500' };
  if (status === 'rejected') return { label: 'Rejeitado', className: 'border-destructive/25 bg-destructive/10 text-destructive' };
  return { label: 'Revisar', className: 'border-amber-500/25 bg-amber-500/10 text-amber-500' };
};

function Metric({ label, value, detail, icon: Icon, attention = false }: { label: string; value: string | number; detail: string; icon: typeof Users; attention?: boolean }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card/70">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${attention ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PsV2EventTeam() {
  const { eventId } = useParams();
  const { data: event, isLoading: eventLoading } = usePsEvent(eventId);
  const { data: officialTeam = [] } = usePsEventCollaborators(eventId);
  const { data: confirmationSummary = {} } = usePsEventConfirmationSummary(eventId);
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: participations = [] } = usePsCollaboratorParticipations();
  const staffingQuery = usePsV2EventStaffing(eventId);
  const reviewQuery = usePsV2AllocationReview(eventId);
  const eligibilityQuery = usePsV2Eligibility();
  const mutations = usePsV2AllocationReviewMutations(eventId);
  const [candidateItem, setCandidateItem] = useState<any | null>(null);

  const staffing = staffingQuery.data;
  const review = reviewQuery.data;
  const requirements = staffing?.requirements || [];
  const items = review?.items || [];
  const run = review?.run || null;
  const eligibilityRules = eligibilityQuery.data?.rules || [];

  const collaboratorById = useMemo(
    () => new Map(collaborators.map((collaborator: any) => [collaborator.id, collaborator])),
    [collaborators],
  );
  const requirementById = useMemo(
    () => new Map(requirements.map((requirement: any) => [requirement.id, requirement])),
    [requirements],
  );

  const getScopeName = (requirement: any) => {
    if (!requirement) return 'Escopo não localizado';
    const scopeId = requirement[`${requirement.scope_type}_id`];
    return staffing?.scopes?.[`${requirement.scope_type}:${scopeId}`]?.name || 'Estrutura sem nome';
  };

  const vacantRequirements = useMemo(() => {
    const available = officialTeam.map((member: any, index: number) => ({ member, index, used: false }));

    return requirements.map((requirement: any) => {
      const quantity = Math.max(0, Number(requirement.quantity || 0));
      if (!quantity) return { ...requirement, quantity: 0 };
      const roleName = requirement.role_name_snapshot;
      const scopeName = getScopeName(requirement);

      const roleMatches = (member: any) => looselyMatches(member.assigned_role || member.role_name, roleName);
      const scopeMatches = (member: any) => {
        if (requirement.scope_type === 'location') return looselyMatches(member.campus || member.institution, scopeName);
        if (requirement.scope_type === 'building') return looselyMatches(member.building, scopeName);
        if (requirement.scope_type === 'floor') return looselyMatches(member.floor, scopeName);
        if (requirement.scope_type === 'environment') return looselyMatches(member.room, scopeName);
        if (requirement.scope_type === 'area') return looselyMatches(member.room || member.sector, scopeName);
        return false;
      };

      let consumed = 0;
      for (const entry of available) {
        if (consumed >= quantity) break;
        if (!entry.used && roleMatches(entry.member) && scopeMatches(entry.member)) {
          entry.used = true;
          consumed += 1;
        }
      }
      for (const entry of available) {
        if (consumed >= quantity) break;
        if (!entry.used && roleMatches(entry.member)) {
          entry.used = true;
          consumed += 1;
        }
      }
      return { ...requirement, quantity: Math.max(0, quantity - consumed) };
    }).filter((requirement: any) => Number(requirement.quantity || 0) > 0);
  }, [requirements, officialTeam, staffing?.scopes]);

  const totalSlots = requirements.reduce((sum: number, requirement: any) => sum + Number(requirement.quantity || 0), 0);
  const vacantSlots = vacantRequirements.reduce((sum: number, requirement: any) => sum + Number(requirement.quantity || 0), 0);
  const accepted = items.filter((item: any) => item.status === 'accepted');
  const rejected = items.filter((item: any) => item.status === 'rejected');
  const suggested = items.filter((item: any) => item.status === 'suggested');
  const filled = items.filter((item: any) => !!item.collaborator_id);
  const reviewedCount = accepted.length + rejected.length;
  const reviewPercent = items.length ? Math.round((reviewedCount / items.length) * 100) : 0;
  const duplicateAccepted = accepted
    .map((item: any) => item.collaborator_id)
    .filter(Boolean)
    .filter((id: string, index: number, ids: string[]) => ids.indexOf(id) !== index);

  const schemaReady = staffing?.schemaReady !== false && review?.schemaReady !== false && eligibilityQuery.data?.schemaReady !== false;
  const generateDisabled = !schemaReady || !requirements.length || mutations.savePlan.isPending || staffingQuery.isLoading || eligibilityQuery.isLoading;

  const generatePlan = () => {
    if (!eventId || !event) return;
    if (!schemaReady) return toast.warning('A estrutura V2 ainda não foi ativada no banco.');
    if (!requirements.length) return toast.warning('Cadastre as necessidades de equipe antes de gerar a alocação.');
    if (!vacantRequirements.length) return toast.success('As necessidades já estão cobertas pela equipe oficial atual.');

    const officialIds = officialTeam.map((member: any) => member.collaborator_id).filter(Boolean);
    const lockedItems = items.filter((item: any) => item.locked && item.collaborator_id);
    const plan = buildPsV2AllocationPlan({
      requirements: vacantRequirements,
      collaborators,
      participations,
      eligibilityRules,
      eventId,
      eventDate: event.date,
      excludedCollaboratorIds: officialIds,
      lockedItems,
    });

    mutations.savePlan.mutate({
      plan,
      strategy: {
        version: 2,
        mode: run ? 'recalculate_unlocked' : 'automatic_draft',
        official_team_preserved: true,
        legacy_publication_locked: true,
        eligibility_rules: eligibilityRules.length,
      },
    });
  };

  const candidateRequirement = candidateItem ? requirementById.get(candidateItem.requirement_id) || null : null;
  const candidateExcludedIds = useMemo(() => {
    if (!candidateItem) return [];
    return [
      ...officialTeam.map((member: any) => member.collaborator_id),
      ...items.filter((item: any) => item.id !== candidateItem.id).map((item: any) => item.collaborator_id),
    ].filter(Boolean);
  }, [candidateItem, officialTeam, items]);

  const replaceCandidate = (candidate: PsV2RankedCandidate) => {
    if (!candidateItem) return;
    mutations.updateItem.mutate({
      id: candidateItem.id,
      patch: {
        collaborator_id: candidate.collaborator.id,
        score: candidate.score,
        score_breakdown: {
          ...(candidateItem.score_breakdown || {}),
          collaborator_name: candidate.collaborator.full_name,
          reasons: candidate.reasons,
          manual_replacement: true,
        },
        allocation_source: 'manual',
        status: 'suggested',
        locked: true,
      },
    }, { onSuccess: () => setCandidateItem(null) });
  };

  if (eventLoading) return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando evento...</div></MainLayout>;

  if (!event) {
    return <MainLayout><Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><p className="text-sm font-medium">Evento não encontrado.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to={`${PS_V2_BASE_PATH}/equipe`}>Voltar para equipe</Link></Button></CardContent></Card></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to={PS_V2_BASE_PATH} className="transition hover:text-foreground">Processo Seletivo 2</Link><span>/</span>
        <Link to={`${PS_V2_BASE_PATH}/equipe`} className="transition hover:text-foreground">Equipe</Link><span>/</span>
        <span className="max-w-[320px] truncate text-foreground">{event.name}</span>
      </div>

      <PageHeader
        title={event.name}
        description={`${formatDate(event.date)} · ${event.location || 'Local não informado'} · Equipe e alocação V2`}
        actions={<div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · paralelo</Badge>
          <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status}</Badge>
          <Button variant="default" size="sm" disabled={generateDisabled} onClick={generatePlan}>
            {run ? <RefreshCw className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {mutations.savePlan.isPending ? 'Calculando...' : run ? 'Recalcular livres' : 'Gerar proposta'}
          </Button>
          <Button asChild variant="outline" size="sm"><Link to={`${PS_V2_BASE_PATH}/equipe`}><ArrowLeft className="mr-2 h-4 w-4" />Eventos</Link></Button>
        </div>}
      />

      <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]">
        <CardContent className="flex gap-3 p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Modo seguro ativado: o módulo antigo continua oficial.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">O motor pode gerar, recalcular e revisar propostas no V2. A publicação na equipe oficial está bloqueada nesta fase para não interferir no Processo Seletivo que você está usando.</p></div></CardContent>
      </Card>

      {!schemaReady && <Card className="mb-5 rounded-2xl border-amber-500/25 bg-amber-500/[0.06]"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><p className="text-sm font-semibold">Estrutura V2 ainda não ativada no banco.</p><p className="mt-1 text-xs text-muted-foreground">A interface está pronta, mas geração e gravação da proposta só funcionarão quando ativarmos as tabelas V2 em um momento seguro.</p></div></CardContent></Card>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Necessidades" value={totalSlots} detail={`${vacantSlots} ainda não cobertas pela equipe atual`} icon={MapPinned} />
        <Metric label="Proposta" value={filled.length} detail={`${items.length} vagas processadas`} icon={Users} />
        <Metric label="Aceitos" value={accepted.length} detail={`${reviewPercent}% da proposta revisada`} icon={UserCheck} />
        <Metric label="Pendências" value={suggested.length + duplicateAccepted.length} detail={duplicateAccepted.length ? 'Há duplicidade para corrigir' : 'Itens ainda em revisão'} icon={AlertTriangle} attention={suggested.length > 0 || duplicateAccepted.length > 0} />
        <Metric label="Equipe oficial" value={officialTeam.length} detail={`${Number(confirmationSummary.confirmed || 0)} confirmados · preservada`} icon={CheckCircle2} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="rounded-2xl border-border/60 bg-card/70">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">Revisão da alocação</CardTitle>{run ? <Badge variant="secondary">{run.status === 'published' ? 'Publicada' : run.status === 'review' ? 'Em revisão' : 'Rascunho'}</Badge> : null}<Badge variant="outline">{eligibilityRules.length} regra(s) de elegibilidade</Badge></div><CardDescription className="mt-1">Gere a proposta, faça trocas manuais, fixe escolhas e recalcule somente o que ficou livre.</CardDescription></div>{run?.status === 'review' && items.length > 0 ? <Button variant="outline" size="sm" onClick={() => mutations.acceptAllFilled.mutate({ runId: run.id })} disabled={mutations.acceptAllFilled.isPending || !suggested.some((item: any) => item.collaborator_id)}><Check className="mr-2 h-4 w-4" />Aceitar preenchidos</Button> : null}</div>
              {items.length > 0 ? <div className="pt-3"><div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground"><span>Revisão da proposta</span><span>{reviewedCount}/{items.length}</span></div><Progress value={reviewPercent} className="h-1.5" /></div> : null}
            </CardHeader>
            <CardContent className="p-0">
              {reviewQuery.isLoading || staffingQuery.isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando alocação...</div> : !run ? <div className="p-8 text-center"><Sparkles className="mx-auto h-8 w-8 text-primary/60" /><p className="mt-3 text-sm font-medium">Pronto para gerar a primeira proposta automática.</p><p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">O cálculo preserva a equipe oficial existente, aplica a matriz de elegibilidade e não publica nada no módulo antigo.</p><Button className="mt-4" size="sm" onClick={generatePlan} disabled={generateDisabled}><Sparkles className="mr-2 h-4 w-4" />Gerar proposta</Button></div> : !items.length ? <div className="p-8 text-center text-sm text-muted-foreground">Esta proposta não possui itens para revisão.</div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Escopo</TableHead><TableHead>Função</TableHead><TableHead>Colaborador</TableHead><TableHead className="w-24">Score</TableHead><TableHead className="w-28">Status</TableHead><TableHead className="w-20 text-center">Fixo</TableHead><TableHead className="w-[270px] text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{items.map((item: any) => { const requirement: any = requirementById.get(item.requirement_id); const collaborator: any = collaboratorById.get(item.collaborator_id); const status = reviewStatus(item.status); const collaboratorName = collaborator?.full_name || item.score_breakdown?.collaborator_name || (item.collaborator_id ? 'Colaborador vinculado' : 'Vaga não preenchida'); return <TableRow key={item.id}><TableCell><p className="text-sm font-medium">{getScopeName(requirement)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{scopeLabels[requirement?.scope_type] || 'Escopo'} · vaga {Number(item.score_breakdown?.slot || 1)}</p></TableCell><TableCell><p className="text-sm">{requirement?.role_name_snapshot || 'Função não localizada'}</p></TableCell><TableCell><p className={`text-sm font-medium ${!item.collaborator_id ? 'text-muted-foreground' : ''}`}>{collaboratorName}</p>{collaborator?.sector || collaborator?.unit ? <p className="mt-0.5 text-[11px] text-muted-foreground">{collaborator.sector || collaborator.unit}</p> : null}</TableCell><TableCell className="font-mono text-xs">{Number(item.score || 0).toFixed(1)}</TableCell><TableCell><Badge variant="outline" className={status.className}>{status.label}</Badge></TableCell><TableCell className="text-center">{item.locked ? <Lock className="mx-auto h-4 w-4 text-primary" /> : <LockOpen className="mx-auto h-4 w-4 text-muted-foreground/40" />}</TableCell><TableCell className="text-right">{run.status === 'review' ? <div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => setCandidateItem(item)} disabled={mutations.updateItem.isPending}>Trocar</Button><Button variant="ghost" size="sm" disabled={!item.collaborator_id || item.status === 'accepted' || mutations.updateItem.isPending} onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { status: 'accepted' } })}>Aceitar</Button><Button variant="ghost" size="sm" disabled={item.status === 'rejected' || mutations.updateItem.isPending} onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { status: 'rejected' } })}>Rejeitar</Button><Button variant="ghost" size="icon" title={item.locked ? 'Desfixar sugestão' : 'Fixar sugestão'} disabled={mutations.updateItem.isPending} onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { locked: !item.locked } })}>{item.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}</Button></div> : <span className="text-xs text-muted-foreground">Somente leitura</span>}</TableCell></TableRow>; })}</TableBody></Table></div>}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.04] xl:sticky xl:top-20"><CardHeader className="pb-3"><CardTitle className="text-base">Publicação da equipe</CardTitle><CardDescription>Bloqueada enquanto o módulo antigo estiver em operação.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2 text-xs text-muted-foreground"><div className="flex items-center justify-between"><span>Itens aceitos</span><strong className="text-foreground">{accepted.length}</strong></div><div className="flex items-center justify-between"><span>Aguardando revisão</span><strong className={suggested.length ? 'text-amber-500' : 'text-foreground'}>{suggested.length}</strong></div><div className="flex items-center justify-between"><span>Duplicidades aceitas</span><strong className={duplicateAccepted.length ? 'text-destructive' : 'text-foreground'}>{duplicateAccepted.length}</strong></div></div><Button className="w-full" disabled><ShieldCheck className="mr-2 h-4 w-4" />Publicação temporariamente bloqueada</Button><p className="text-[11px] leading-relaxed text-muted-foreground">Mesmo com a revisão completa, o V2 não enviará integrantes para a equipe oficial nesta fase. Isso protege a operação dos próximos dias.</p><div className="border-t border-border/60 pt-3"><Button asChild variant="outline" size="sm" className="w-full"><Link to={`${PS_V2_BASE_PATH}/locais`}><MapPinned className="mr-2 h-4 w-4" />Revisar estrutura</Link></Button><Button asChild variant="ghost" size="sm" className="mt-1 w-full"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Abrir módulo oficial <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button></div></CardContent></Card>

          <Card className="rounded-2xl border-border/60 bg-card/70"><CardHeader className="pb-2"><CardTitle className="text-sm">Leitura operacional</CardTitle></CardHeader><CardContent className="space-y-2 text-xs text-muted-foreground"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-500" />{accepted.length} alocações aceitas</div><div className="flex items-center gap-2"><UserRoundX className="h-4 w-4 text-destructive" />{rejected.length} vagas rejeitadas/sem alocação</div><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{officialTeam.length} pessoas preservadas na equipe oficial</div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />{eligibilityRules.length} regras de elegibilidade ativas/cadastradas</div></CardContent></Card>
        </aside>
      </div>

      <PsV2CandidateDialog
        open={!!candidateItem}
        onOpenChange={(open) => { if (!open) setCandidateItem(null); }}
        requirement={candidateRequirement as any}
        collaborators={collaborators as any[]}
        participations={participations as any[]}
        eligibilityRules={eligibilityRules as any[]}
        eventId={eventId}
        eventDate={event.date}
        excludedCollaboratorIds={candidateExcludedIds}
        onSelect={replaceCandidate}
        isSaving={mutations.updateItem.isPending}
      />
    </MainLayout>
  );
}
