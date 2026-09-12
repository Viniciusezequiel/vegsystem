import { useMemo } from 'react';
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
  Send,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  usePsCollaborators,
  usePsEvent,
  usePsEventCollaborators,
  usePsEventConfirmationSummary,
} from '@/hooks/useProcessoSeletivo';
import { usePsV2AllocationReview, usePsV2AllocationReviewMutations } from '@/hooks/usePsV2AllocationReview';
import { usePsV2EventStaffing } from '@/hooks/usePsV2EventStaffing';
import { PS_EVENT_STATUS } from '@/lib/psConstants';
import { PS_V2_BASE_PATH } from '@/lib/psV2Architecture';

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data definida';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
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
  const staffingQuery = usePsV2EventStaffing(eventId);
  const reviewQuery = usePsV2AllocationReview(eventId);
  const mutations = usePsV2AllocationReviewMutations(eventId);

  const staffing = staffingQuery.data;
  const review = reviewQuery.data;
  const requirements = staffing?.requirements || [];
  const items = review?.items || [];
  const run = review?.run || null;

  const collaboratorById = useMemo(
    () => new Map(collaborators.map((collaborator: any) => [collaborator.id, collaborator])),
    [collaborators],
  );
  const requirementById = useMemo(
    () => new Map(requirements.map((requirement: any) => [requirement.id, requirement])),
    [requirements],
  );

  const totalSlots = requirements.reduce((sum: number, requirement: any) => sum + Number(requirement.quantity || 0), 0);
  const accepted = items.filter((item: any) => item.status === 'accepted');
  const rejected = items.filter((item: any) => item.status === 'rejected');
  const suggested = items.filter((item: any) => item.status === 'suggested');
  const filled = items.filter((item: any) => !!item.collaborator_id);
  const reviewedCount = accepted.length + rejected.length;
  const reviewPercent = items.length ? Math.round((reviewedCount / items.length) * 100) : 0;
  const acceptedIds = accepted.map((item: any) => item.collaborator_id).filter(Boolean);
  const duplicateAccepted = acceptedIds.filter((id: string, index: number) => acceptedIds.indexOf(id) !== index);
  const acceptedWithoutCollaborator = accepted.some((item: any) => !item.collaborator_id);
  const suggestedWithCollaborator = suggested.some((item: any) => !!item.collaborator_id);
  const canPublish = run?.status === 'review'
    && accepted.length > 0
    && !acceptedWithoutCollaborator
    && !suggestedWithCollaborator
    && duplicateAccepted.length === 0;

  const getScopeName = (requirement: any) => {
    if (!requirement) return 'Escopo não localizado';
    const scopeId = requirement[`${requirement.scope_type}_id`];
    return staffing?.scopes?.[`${requirement.scope_type}:${scopeId}`]?.name || 'Estrutura sem nome';
  };

  const publish = () => {
    if (!run?.id || !canPublish) return;
    const acceptedCount = accepted.length;
    const confirmed = window.confirm(`Publicar ${acceptedCount} integrante(s) revisado(s) na equipe oficial deste evento?`);
    if (confirmed) mutations.publishRun.mutate({ runId: run.id });
  };

  if (eventLoading) {
    return <MainLayout><div className="py-16 text-center text-sm text-muted-foreground">Carregando evento...</div></MainLayout>;
  }

  if (!event) {
    return (
      <MainLayout>
        <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center"><p className="text-sm font-medium">Evento não encontrado.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to={`${PS_V2_BASE_PATH}/equipe`}>Voltar para equipe</Link></Button></CardContent></Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link to={PS_V2_BASE_PATH} className="transition hover:text-foreground">Processo Seletivo 2</Link>
        <span>/</span>
        <Link to={`${PS_V2_BASE_PATH}/equipe`} className="transition hover:text-foreground">Equipe</Link>
        <span>/</span>
        <span className="max-w-[320px] truncate text-foreground">{event.name}</span>
      </div>

      <PageHeader
        title={event.name}
        description={`${formatDate(event.date)} · ${event.location || 'Local não informado'} · Equipe e alocação V2`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">V2 · paralelo</Badge>
            <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status] || event.status}</Badge>
            <Button asChild variant="outline" size="sm"><Link to={`${PS_V2_BASE_PATH}/equipe`}><ArrowLeft className="mr-2 h-4 w-4" />Eventos</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Equipe oficial <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        )}
      />

      <Card className="mb-5 rounded-2xl border-emerald-500/20 bg-emerald-500/[0.05]">
        <CardContent className="flex gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div>
            <p className="text-sm font-semibold">Ambiente de revisão: nada é publicado automaticamente.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A equipe usada hoje continua no módulo atual. Aqui você revisa a proposta e só transfere os integrantes aceitos ao clicar em “Publicar equipe”.</p>
          </div>
        </CardContent>
      </Card>

      {(staffing?.schemaReady === false || review?.schemaReady === false) && (
        <Card className="mb-5 rounded-2xl border-amber-500/25 bg-amber-500/[0.06]">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div><p className="text-sm font-semibold">Estrutura V2 ainda não ativada no banco.</p><p className="mt-1 text-xs text-muted-foreground">A tela permanece isolada e segura. A migration será aplicada somente quando decidirmos liberar o V2 para testes integrados.</p></div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Necessidades" value={totalSlots} detail={`${requirements.length} regras de equipe`} icon={MapPinned} />
        <Metric label="Proposta" value={filled.length} detail={`${items.length} vagas processadas`} icon={Users} />
        <Metric label="Aceitos" value={accepted.length} detail={`${reviewPercent}% da proposta revisada`} icon={UserCheck} />
        <Metric label="Pendências" value={suggested.length + duplicateAccepted.length} detail={duplicateAccepted.length ? 'Há duplicidade para corrigir' : 'Itens ainda em revisão'} icon={AlertTriangle} attention={suggested.length > 0 || duplicateAccepted.length > 0} />
        <Metric label="Equipe oficial" value={officialTeam.length} detail={`${Number(confirmationSummary.confirmed || 0)} confirmados`} icon={CheckCircle2} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card className="rounded-2xl border-border/60 bg-card/70">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">Revisão da alocação</CardTitle>
                    {run ? <Badge variant="secondary">{run.status === 'published' ? 'Publicada' : run.status === 'review' ? 'Em revisão' : 'Rascunho'}</Badge> : null}
                  </div>
                  <CardDescription className="mt-1">Aceite, rejeite ou fixe cada sugestão antes da publicação.</CardDescription>
                </div>
                {run?.status === 'review' && items.length > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mutations.acceptAllFilled.mutate({ runId: run.id })}
                    disabled={mutations.acceptAllFilled.isPending || !suggestedWithCollaborator}
                  >
                    <Check className="mr-2 h-4 w-4" />Aceitar preenchidos
                  </Button>
                ) : null}
              </div>
              {items.length > 0 ? <div className="pt-3"><div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground"><span>Revisão da proposta</span><span>{reviewedCount}/{items.length}</span></div><Progress value={reviewPercent} className="h-1.5" /></div> : null}
            </CardHeader>
            <CardContent className="p-0">
              {reviewQuery.isLoading || staffingQuery.isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Carregando alocação...</div>
              ) : !run ? (
                <div className="p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">Ainda não existe uma proposta de alocação para este evento.</p>
                  <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">A tela já está preparada para receber a proposta automática. Não criamos um botão fictício de geração enquanto o motor de alocação não estiver conectado ao fluxo visual.</p>
                </div>
              ) : !items.length ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Esta proposta não possui itens para revisão.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Escopo</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead className="w-24">Score</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-20 text-center">Fixo</TableHead>
                        <TableHead className="w-[210px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => {
                        const requirement: any = requirementById.get(item.requirement_id);
                        const collaborator: any = collaboratorById.get(item.collaborator_id);
                        const status = reviewStatus(item.status);
                        const collaboratorName = collaborator?.full_name || item.score_breakdown?.collaborator_name || (item.collaborator_id ? 'Colaborador vinculado' : 'Vaga não preenchida');
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{getScopeName(requirement)}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{scopeLabels[requirement?.scope_type] || 'Escopo'}</p>
                            </TableCell>
                            <TableCell><p className="text-sm">{requirement?.role_name_snapshot || 'Função não localizada'}</p></TableCell>
                            <TableCell>
                              <p className={`text-sm font-medium ${!item.collaborator_id ? 'text-muted-foreground' : ''}`}>{collaboratorName}</p>
                              {collaborator?.sector || collaborator?.unit ? <p className="mt-0.5 text-[11px] text-muted-foreground">{collaborator.sector || collaborator.unit}</p> : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{Number(item.score || 0).toFixed(1)}</TableCell>
                            <TableCell><Badge variant="outline" className={status.className}>{status.label}</Badge></TableCell>
                            <TableCell className="text-center">{item.locked ? <Lock className="mx-auto h-4 w-4 text-primary" /> : <LockOpen className="mx-auto h-4 w-4 text-muted-foreground/40" />}</TableCell>
                            <TableCell className="text-right">
                              {run.status === 'review' ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!item.collaborator_id || item.status === 'accepted' || mutations.updateItem.isPending}
                                    onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { status: 'accepted' } })}
                                  >Aceitar</Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={item.status === 'rejected' || mutations.updateItem.isPending}
                                    onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { status: 'rejected' } })}
                                  >Rejeitar</Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title={item.locked ? 'Desfixar sugestão' : 'Fixar sugestão'}
                                    disabled={mutations.updateItem.isPending}
                                    onClick={() => mutations.updateItem.mutate({ id: item.id, patch: { locked: !item.locked } })}
                                  >{item.locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}</Button>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">Somente leitura</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-border/60 bg-card/70 xl:sticky xl:top-20">
            <CardHeader className="pb-3"><CardTitle className="text-base">Publicação da equipe</CardTitle><CardDescription>Última barreira antes de alterar a equipe oficial.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {run?.status === 'published' ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3"><div className="flex items-center gap-2 text-sm font-medium text-emerald-500"><CheckCircle2 className="h-4 w-4" />Proposta publicada</div><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Esta revisão já foi transferida para a equipe oficial sem duplicar vínculos existentes.</p></div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between"><span>Itens aceitos</span><strong className="text-foreground">{accepted.length}</strong></div>
                  <div className="flex items-center justify-between"><span>Aguardando revisão</span><strong className={suggested.length ? 'text-amber-500' : 'text-foreground'}>{suggested.length}</strong></div>
                  <div className="flex items-center justify-between"><span>Duplicidades aceitas</span><strong className={duplicateAccepted.length ? 'text-destructive' : 'text-foreground'}>{duplicateAccepted.length}</strong></div>
                </div>
              )}

              <Button className="w-full" onClick={publish} disabled={!canPublish || mutations.publishRun.isPending || run?.status === 'published'}>
                {run?.status === 'published' ? <><CheckCircle2 className="mr-2 h-4 w-4" />Equipe publicada</> : <><Send className="mr-2 h-4 w-4" />{mutations.publishRun.isPending ? 'Publicando...' : 'Publicar equipe'}</>}
              </Button>
              {!canPublish && run?.status === 'review' ? <p className="text-[11px] leading-relaxed text-muted-foreground">Para liberar a publicação, todos os itens preenchidos precisam estar revisados, deve existir ao menos um aceite e não pode haver a mesma pessoa aceita em duas vagas.</p> : null}

              <div className="border-t border-border/60 pt-3">
                <Button asChild variant="outline" size="sm" className="w-full"><Link to={`${PS_V2_BASE_PATH}/locais`}><MapPinned className="mr-2 h-4 w-4" />Revisar estrutura</Link></Button>
                <Button asChild variant="ghost" size="sm" className="mt-1 w-full"><Link to={`/admin-module/processo-seletivo/eventos/${event.id}`}>Abrir equipe oficial <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-card/70">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Leitura operacional</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-500" />{accepted.length} alocações aceitas</div>
              <div className="flex items-center gap-2"><UserRoundX className="h-4 w-4 text-destructive" />{rejected.length} vagas rejeitadas/sem alocação</div>
              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{officialTeam.length} pessoas na equipe oficial atual</div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </MainLayout>
  );
}
