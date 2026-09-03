import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { PsEventTeamImportDialog } from '@/components/processo-seletivo/PsEventTeamImportDialog';
import { PsEventCommunicationTab } from '@/components/processo-seletivo/PsEventCommunicationTab';
import {
  usePsEvent, usePsEventMutations, usePsEventCollaborators, usePsEventCollaboratorMutations,
  usePsCollaborators, usePsRoles, usePsEvaluations, usePsSaveEvaluation, usePsCandidates,
  usePsCandidateMutations, usePsSelfEvaluations, usePsClearEventTeam, usePsEventConfirmationSummary, usePsConfirmationActions,
} from '@/hooks/useProcessoSeletivo';
import { getPsConfirmationStatusLabel, replacementAssignment } from '@/lib/psConfirmationState.mjs';
import { useAuth } from '@/contexts/AuthContext';
import { PS_EVENT_STATUS, PS_CLASSIFICATION_LABEL, PS_PCD_OPTIONS } from '@/lib/psConstants';
import { ArrowLeft, Plus, Trash2, Copy, Download, CheckCircle2, Upload, Star, Pencil, IdCard, FileSignature, ShieldCheck } from 'lucide-react';
import { generatePsBadgesPdf, generatePsCandidateBadgesPdf, generatePsAttendancePdfAsync } from '@/lib/psEventPdf';
import { psPresencePatch } from '@/lib/psFiscalFoundation';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export default function PsEventDetail() {
  const { id } = useParams();
  const { data: event } = usePsEvent(id);
  const { finalize, save } = usePsEventMutations();
  const { data: links = [] } = usePsEventCollaborators(id);
  const { add, update, updateState, remove } = usePsEventCollaboratorMutations(id);
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { data: evaluations = [] } = usePsEvaluations(id);
  const { data: selfEvaluations = [] } = usePsSelfEvaluations(id);
  const saveEval = usePsSaveEvaluation();
  const { data: candidates = [] } = usePsCandidates(id);
  const { addMany, removeAll } = usePsCandidateMutations();
  const { profile } = useAuth();
  const clearTeam = usePsClearEventTeam();
  const { data: confirmationSummary = {} } = usePsEventConfirmationSummary(id);
  const confirmationActions = usePsConfirmationActions(id);

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLink, setEditLink] = useState<any>(null);
  const [searchFiscal, setSearchFiscal] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [roleValue, setRoleValue] = useState('');
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [comments, setComments] = useState('');
  const [confirmationSearch, setConfirmationSearch] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState('all');
  const [confirmationRole, setConfirmationRole] = useState('all');
  const [confirmationUnit, setConfirmationUnit] = useState('all');
  const [replacementTarget, setReplacementTarget] = useState<any>(null);
  const [replacementFiscalId, setReplacementFiscalId] = useState('');
  const [replacementData, setReplacementData] = useState<any>(null);
  const [presenceSearch, setPresenceSearch] = useState('');
  const [presenceListOpen, setPresenceListOpen] = useState(false);

  const publicBase = `${window.location.origin}/ps`;

  const confirmationRows = useMemo(() => {
    const query = confirmationSearch.trim().toLowerCase();
    return links.filter((link: any) => (confirmationStatus === 'all' || link.participation_status === confirmationStatus)
      && (confirmationRole === 'all' || (link.role_name || link.assigned_role || 'Sem função') === confirmationRole)
      && (confirmationUnit === 'all' || (link.unit || 'Sem unidade') === confirmationUnit)
      && (!query || [link.collaborator_name, link.role_name, link.assigned_role, link.unit, link.room].filter(Boolean).join(' ').toLowerCase().includes(query)));
  }, [links, confirmationSearch, confirmationStatus, confirmationRole, confirmationUnit]);

  const presenceRows = useMemo(() => {
    const query = presenceSearch.trim().toLowerCase();

    return [...links]
      .filter((link: any) => {
        if (!query) return true;

        return [
          link.collaborator_name,
          link.role_name,
          link.assigned_role,
          link.building,
          link.floor,
          link.room,
          link.unit,
          link.sector,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a: any, b: any) =>
        String(a.collaborator_name || '').localeCompare(
          String(b.collaborator_name || ''),
          'pt-BR'
        )
      );
  }, [links, presenceSearch]);

  const replacementCandidates = useMemo(() => {
    const currentIds = new Set(links.map((link: any) => link.collaborator_id));
    return collaborators.filter((candidate: any) => candidate.active && !currentIds.has(candidate.id));
  }, [collaborators, links]);

  const requestConfirmation = async (link: any) => {
    try {
      const result = await confirmationActions.request.mutateAsync({
        linkId: link.id,
        rotate: !!link.public_confirmation_token_expires_at,
      });
      copy(`${publicBase}/confirmacao/${id}/${result.token}`);
    } catch { /* mutation already reports a safe error */ }
  };

  const openReplacement = (link: any) => {
    setReplacementTarget(link); setReplacementFiscalId(''); setReplacementData(replacementAssignment(link));
  };

  const submitReplacement = async () => {
    if (!replacementTarget || !replacementFiscalId) return;
    await confirmationActions.replace.mutateAsync({ oldLinkId: replacementTarget.id, collaboratorId: replacementFiscalId, assignment: replacementData });
    setReplacementTarget(null); setReplacementFiscalId(''); setReplacementData(null);
  };

  const setParticipantState = (link: any, patch: Partial<{ present: boolean; absent: boolean; departed_at: string | null }>) => {
    updateState.mutate({
      id: link.id,
      updated_at: link.updated_at,
      present: patch.present ?? link.present,
      absent: patch.absent ?? link.absent,
      departed_at: patch.departed_at === undefined ? link.departed_at : patch.departed_at,
    });
  };

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const rolePay = (slug?: string | null) => {
    const r: any = roles.find((x: any) => x.value === slug);
    if (!r) return 0;
    const combined = (r.combined_roles || []).reduce(
      (acc: number, s: string) => acc + Number((roles.find((x: any) => x.value === s) as any)?.pay_value || 0), 0);
    return Number(r.pay_value || 0) + combined;
  };

  const totalCost = links.filter((l: any) => !l.absent).reduce((acc: number, l: any) => acc + rolePay(l.role_value), 0);
  const visibleCollaborators = useMemo(() => {
    const q = searchFiscal.trim().toLowerCase();
    return collaborators
      .filter((c: any) => c.active && !links.some((l: any) => l.collaborator_id === c.id))
      .filter((c: any) => !q || [c.full_name, c.email, c.matricula, c.institution, c.unit, c.role].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [collaborators, links, searchFiscal]);

  const linkFiscals = async () => {
    if (!selected.length || !roleValue) return;
    const roleObj: any = roles.find((r: any) => r.value === roleValue);
    const rows = selected.map((cid) => {
      const c: any = collaborators.find((x: any) => x.id === cid);
      return {
        event_id: id,
        collaborator_id: cid,
        collaborator_name: c?.full_name,
        role_value: roleValue,
        role_name: roleObj?.name,
        pay_value: rolePay(roleValue),
      };
    });
    await add.mutateAsync(rows);
    setAddOpen(false);
    setSelected([]);
    setRoleValue('');
  };

  const submitEvaluation = async () => {
    await saveEval.mutateAsync({
      event_id: id,
      collaborator_id: evalTarget.collaborator_id,
      collaborator_name: evalTarget.collaborator_name,
      assigned_role: evalTarget.role_value || evalTarget.assigned_role || evalTarget.role_name || '',
      evaluator_name: profile?.full_name || 'Sistema',
      observations: comments.trim() || null,
      ...criteria,
    });
    setEvalTarget(null);
    setCriteria(emptyCriteria());
    setComments('');
  };

  const importCandidates = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const pick = (r: any, keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find((c) => c.trim().toUpperCase() === k.toUpperCase());
        if (found && String(r[found]).trim()) return String(r[found]).trim();
      }
      return '';
    };
    const mapped = rows.map((r) => ({
      event_id: id,
      process_name: pick(r, ['PROCESSO SELETIVO', 'PROCESSO']) || null,
      registration_number: pick(r, ['INSCRIÇÃO', 'INSCRICAO', 'Inscrição']) || null,
      full_name: pick(r, ['CANDIDATO', 'NOME', 'Nome']),
      phone: pick(r, ['CELULAR', 'TELEFONE']) || null,
      email: pick(r, ['E-MAIL', 'EMAIL']) || null,
      rg: pick(r, ['IDENTIDADE', 'RG']) || null,
      cpf: pick(r, ['CPF', 'DOCUMENTO']) || null,
      exam_type: pick(r, ['TIPO DE PROVA', 'TIPO']) || null,
      campus: pick(r, ['LOCAL DE PROVA', 'CAMPUS', 'LOCAL']) || null,
      room: pick(r, ['SALA']) || null,
      barcode: pick(r, ['CÓD DE BARRAS', 'COD DE BARRAS', 'CODIGO DE BARRAS']) || null,
      seat_number: pick(r, ['CARTEIRA', 'ASSENTO']) || null,
    })).filter((r) => r.full_name);
    if (mapped.length) addMany.mutate(mapped);
  };


  const resetAttendanceSignature = async (link: any) => {
    if (!link?.signed_at) return;

    const confirmed = window.confirm(
      `Refazer a assinatura de ${link.collaborator_name}?\n\n` +
      'A assinatura atual será apagada e o fiscal voltará para a lista de pendentes.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('ps_event_collaborators')
        .update({
          signature_url: null,
          signature_ip: null,
          signed_at: null,
          present: false,
          absent: false,
          departed_at: null,
        })
        .eq('id', link.id);

      if (error) throw error;

      toast.success(
        `${link.collaborator_name} está liberado para assinar novamente.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível apagar a assinatura.'
      );
    }
  };

  const exportPresence = () => {
    const rows = links.map((l: any) => ({
      Nome: l.collaborator_name,
      Função: l.role_name,
      Sala: l.room || '',
      Presente: l.present ? 'Sim' : 'Não',
      Ausente: l.absent ? 'Sim' : 'Não',
      Assinado: l.signed_at ? 'Sim' : 'Não',
      Saída: l.departed_at ? new Date(l.departed_at).toLocaleString('pt-BR') : '',
      'Valor R$': Number(l.pay_value || 0).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenças');
    XLSX.writeFile(wb, `presencas-${event?.name || 'evento'}.xlsx`);
  };

  const slug = (event?.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const eventInfo = () => ({
    name: event?.name || '',
    date: event?.date ? new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR') : '',
    location: event?.location || '',
  });

  const exportBadges = () => {
    if (!links.length) { toast.error('Nenhum colaborador vinculado ao evento.'); return; }
    generatePsBadgesPdf(eventInfo(), links as any).save(`etiquetas-${slug}.pdf`);
  };

  const exportCandidateBadges = () => {
    if (!candidates.length) {
      toast.error('Nenhum candidato disponível para geração de etiquetas.');
      return;
    }
    const rows = candidates.map((c: any) => ({
      full_name: c.full_name,
      cpf: c.cpf,
      campus: c.campus,
      room: c.room,
      seat_number: c.seat_number || c.seat,
      registration_number: c.registration_number,
      pcd_type: c.pcd_type,
    }));
    generatePsCandidateBadgesPdf(eventInfo(), rows).save(`etiquetas-candidatos-${slug}.pdf`);
  };

  const exportAttendancePdf = async () => {
    if (!links.length) { toast.error('Nenhum colaborador vinculado ao evento.'); return; }
    const { data: signatures, error } = await supabase
      .from('ps_event_collaborators')
      .select('id, signature_url')
      .eq('event_id', id!);
    if (error) { toast.error('Não foi possível carregar as assinaturas para o PDF.'); return; }
    const signatureById = new Map((signatures || []).map(row => [row.id, row.signature_url]));
    const pdfRows = links.map((row: any) => ({ ...row, signature_url: signatureById.get(row.id) ?? null }));
    const pdf = await generatePsAttendancePdfAsync(eventInfo(), pdfRows as any);
    pdf.save(`lista-presenca-${slug}.pdf`);
  };

  if (!event) {
    return <MainLayout><p className="text-muted-foreground">Carregando evento...</p></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button asChild variant="ghost" size="icon"><Link to="/admin-module/processo-seletivo/eventos"><ArrowLeft className="h-4 w-4" /></Link></Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold sm:text-2xl">{event.name}</h1>
                  <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')} · {event.location || 'Local não informado'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportBadges}><IdCard className="mr-2 h-4 w-4" />Etiquetas</Button>
              <Button asChild variant="outline"><Link to={`/admin-module/processo-seletivo/eventos/${id}/avaliadores`}><ShieldCheck className="mr-2 h-4 w-4" />Equipe de avaliação</Link></Button>
              <Button variant="outline" onClick={exportAttendancePdf}><FileSignature className="mr-2 h-4 w-4" />Presença (PDF)</Button>
              <Button variant="outline" onClick={exportPresence}><Download className="mr-2 h-4 w-4" />XLSX</Button>
              {event.status !== 'finalizado' && (
                <Button onClick={() => { if (confirm('Finalizar evento?')) finalize.mutate(event.id); }}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Equipe</p><p className="mt-1 text-2xl font-bold">{links.length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Presentes</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.present).length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ausentes</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.absent).length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Avaliações</p><p className="mt-1 text-2xl font-bold">{links.filter((l: any) => l.evaluated).length}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="visao-geral">
          <TabsList className="flex-wrap">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="fiscais">Equipe</TabsTrigger>
            <TabsTrigger value="confirmacoes">Confirmações</TabsTrigger>
            <TabsTrigger value="comunicacao">Comunicação</TabsTrigger>
            <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
            <TabsTrigger value="presenca">Presença</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4 pt-4">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Links públicos</CardTitle></CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-3">
                {[
                  { label: 'Avaliação de fiscais', url: `${publicBase}/avaliacao/${event.id}` },
                  { label: 'Autoavaliação', url: `${publicBase}/autoavaliacao/${event.id}` },
                  { label: 'Lista de presença/assinatura', url: `${publicBase}/presenca/${event.id}` },
                ].map((l) => (
                  <Button key={l.url} variant="outline" className="justify-between" onClick={() => copy(l.url)}>
                    {l.label} <Copy className="h-4 w-4" />
                  </Button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4 pt-4">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Autoavaliação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Permitir autoavaliação deste evento</p>
                    <p className="text-sm text-muted-foreground">Quando habilitada, este evento ficará disponível para os fiscais realizarem a autoavaliação.</p>
                  </div>
                  <Switch
                    checked={!!event.self_evaluation_enabled}
                    onCheckedChange={async (checked) => {
                      await save.mutateAsync({ ...event, self_evaluation_enabled: checked });
                    }}
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {event.self_evaluation_enabled ? 'Status: Aberta' : 'Status: Fechada'}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fiscais" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setImportOpen(true)}><Upload className="mr-2 h-4 w-4" />Importar planilha</Button>
              <Button variant="outline" onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Vincular manualmente</Button>
              {links.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm('Remover toda a equipe deste evento? Os cadastros e as avaliações dos colaboradores são mantidos.')) clearTeam.mutate(id!); }}>
                  <Trash2 className="mr-2 h-4 w-4" />Limpar equipe
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {links.map((l: any) => (
                <Card key={l.id} className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{l.collaborator_name}</CardTitle>
                      <div className="flex flex-wrap justify-end gap-1">
                        {l.signed_at && <Badge>Assinado</Badge>}
                        {l.departed_at && <Badge variant="outline">Saiu</Badge>}
                        {l.evaluated && <Badge variant="secondary">Avaliado</Badge>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[l.role_name, `R$ ${Number(l.pay_value || 0).toFixed(2)}`, l.building, l.floor, l.room && `Sala ${l.room}`]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><Label className="text-xs">Presente</Label>
                      <Switch checked={!!l.present} onCheckedChange={(v) => setParticipantState(l, psPresencePatch('present', v))} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Ausente</Label>
                      <Switch checked={!!l.absent} onCheckedChange={(v) => setParticipantState(l, psPresencePatch('absent', v))} /></div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setParticipantState(l, {
                      departed_at: l.departed_at ? null : new Date().toISOString(),
                    })} disabled={updateState.isPending}>
                      {l.departed_at ? 'Cancelar saída' : 'Registrar saída'}
                    </Button>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => { setEvalTarget(l); setCriteria(emptyCriteria()); }}>
                        <Star className="mr-1 h-4 w-4" />Avaliar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditLink(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Remover vínculo?')) remove.mutate(l.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {links.length === 0 && <p className="text-muted-foreground">Nenhum fiscal vinculado.</p>}
            </div>
          </TabsContent>

          <TabsContent value="confirmacoes" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[['pending_confirmation', 'Aguardando confirmação'], ['confirmed', 'Confirmados'], ['declined', 'Recusaram'], ['replaced', 'Substituídos']].map(([key, label]) => (
                <Card key={key} className="rounded-2xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-bold">{Number(confirmationSummary[key] || 0)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Input value={confirmationSearch} onChange={(e) => setConfirmationSearch(e.target.value)} placeholder="Buscar por nome, cargo, unidade ou sala" />
              <Select value={confirmationStatus} onValueChange={setConfirmationStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="all">Todos os status</SelectItem><SelectItem value="pending_confirmation">Aguardando</SelectItem><SelectItem value="confirmed">Confirmados</SelectItem><SelectItem value="declined">Recusaram</SelectItem><SelectItem value="replaced">Substituídos</SelectItem>
              </SelectContent></Select>
              <Select value={confirmationRole} onValueChange={setConfirmationRole}><SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os cargos</SelectItem>
                {[...new Set(links.map((link: any) => link.role_name || link.assigned_role || 'Sem função'))].map((role: any) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
              </SelectContent></Select>
              <Select value={confirmationUnit} onValueChange={setConfirmationUnit}><SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as unidades</SelectItem>
                {[...new Set(links.map((link: any) => link.unit || 'Sem unidade'))].map((unit: any) => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
              </SelectContent></Select>
            </div>
            <Card className="rounded-2xl">
              <CardContent className="p-0">
                <div className="divide-y">
                  {confirmationRows.map((l: any) => (
                    <div key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{l.collaborator_name}</p>
                        <p className="text-xs text-muted-foreground">{l.role_name || l.assigned_role || 'Sem função'} · {l.unit || 'Unidade não informada'} · {l.room || 'Sala não informada'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant={l.participation_status === 'confirmed' ? 'default' : l.participation_status === 'declined' ? 'destructive' : l.participation_status === 'replaced' ? 'secondary' : 'outline'}>
                          {getPsConfirmationStatusLabel(l.participation_status)}
                        </Badge>
                        <span>{l.confirmation_requested_at ? new Date(l.confirmation_requested_at).toLocaleDateString('pt-BR') : '—'}</span>
                        <span>{l.confirmed_at ? new Date(l.confirmed_at).toLocaleDateString('pt-BR') : '—'}</span>
                        {l.participation_status !== 'replaced' && <Button size="sm" variant="outline" onClick={() => requestConfirmation(l)} disabled={confirmationActions.request.isPending}>Gerar link</Button>}
                        {l.participation_status !== 'replaced' && <Button size="sm" variant="outline" onClick={() => openReplacement(l)}>Substituir fiscal</Button>}
                      </div>
                    </div>
                  ))}
                  {confirmationRows.length === 0 && <p className="p-4 text-muted-foreground">Nenhum vínculo corresponde aos filtros.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comunicacao" className="pt-4">
            <PsEventCommunicationTab event={event} links={links as any[]} />
          </TabsContent>

          <TabsContent value="presenca" className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Presentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => l.present && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Assinados</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !!l.signed_at).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !l.signed_at && !l.absent).length}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                  <p className="mt-1 text-2xl font-bold">
                    {links.filter((l:any) => !!l.absent).length}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Controle de presença</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Acompanhe assinaturas, ausências e saídas em tempo real.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPresenceListOpen((open) => !open)}
                  >
                    {presenceListOpen
                      ? 'Ocultar fiscais'
                      : `Ver fiscais (${links.length})`}
                  </Button>

                  <Button asChild variant="outline">
                    <a
                      href={`${publicBase}/presenca/${event.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir coleta de assinaturas
                    </a>
                  </Button>
                </div>
              </CardHeader>

              {presenceListOpen && (
              <CardContent className="p-0">
                <div className="border-b p-4">
                  <Input
                    value={presenceSearch}
                    onChange={(event) => setPresenceSearch(event.target.value)}
                    placeholder="Buscar por nome, cargo, prédio, andar ou sala..."
                  />
                </div>

                <div className="max-h-[22rem] divide-y overflow-y-auto">
                  {presenceRows.map((l:any) => (
                      <div
                        key={l.id}
                        className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{l.collaborator_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[
                              l.role_name || l.assigned_role,
                              l.building,
                              l.floor,
                              l.room && `Sala ${l.room}`
                            ].filter(Boolean).join(' · ') || 'Sem localização definida'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {l.absent ? (
                            <Badge variant="destructive">Ausente</Badge>
                          ) : l.signed_at ? (
                            <Badge>Assinado</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )}

                          {l.departed_at && (
                            <Badge variant="secondary">Saída registrada</Badge>
                          )}

                          <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                            <Label className="text-xs">Ausente</Label>
                            <Switch
                              checked={!!l.absent}
                              onCheckedChange={(value) =>
                                setParticipantState(
                                  l,
                                  psPresencePatch('absent', value)
                                )
                              }
                            />
                          </div>

                          {l.signed_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetAttendanceSignature(l)}
                            >
                              Refazer assinatura
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!l.signed_at || l.absent}
                            onClick={() =>
                              setParticipantState(l, {
                                departed_at: l.departed_at
                                  ? null
                                  : new Date().toISOString()
                              })
                            }
                          >
                            {l.departed_at ? 'Cancelar saída' : 'Registrar saída'}
                          </Button>
                        </div>
                      </div>
                    ))}

                  {!presenceRows.length && (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      {presenceSearch
                        ? 'Nenhum fiscal encontrado.'
                        : 'Nenhum fiscal vinculado ao evento.'}
                    </p>
                  )}
                </div>
              </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="avaliacoes" className="pt-4">
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{e.collaborator_name}</p>
                      <p className="text-xs text-muted-foreground">{e.assigned_role || '-'} · por {e.evaluator_name || 'anônimo'}</p>
                      {e.observations && <p className="mt-1 text-sm text-muted-foreground">{e.observations}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[e.classification] || e.classification}</Badge>
                      <Badge>{Number(e.final_score).toFixed(2)}</Badge>
                    </div>
                  </div>
                ))}
                {evaluations.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma avaliação registrada.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auto" className="pt-4">
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {selfEvaluations.map((e: any) => (
                  <div key={e.id} className="space-y-1 p-4">
                    <p className="font-medium">{e.collaborator_name}</p>
                    {e.difficulties && <p className="text-sm text-muted-foreground">Dificuldades: {e.difficulties}</p>}
                    {e.suggestions && <p className="text-sm text-muted-foreground">Sugestões: {e.suggestions}</p>}
                    {e.available_next && <Badge variant="secondary">Disponível para o próximo</Badge>}
                  </div>
                ))}
                {selfEvaluations.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma autoavaliação recebida.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Importar candidatos
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCandidates(e.target.files[0])} />
                </label>
              </Button>
              <Button variant="outline" onClick={exportCandidateBadges} disabled={candidates.length === 0}>
                <IdCard className="mr-2 h-4 w-4" />Etiquetas
              </Button>
              {candidates.length > 0 && (
                <Button variant="outline" onClick={() => { if (confirm('Remover todos os candidatos do evento?')) removeAll.mutate(id!); }}>
                  <Trash2 className="mr-2 h-4 w-4" />Limpar lista
                </Button>
              )}
            </div>
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {candidates.map((c: any) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[c.campus, c.room && `Sala ${c.room}`, c.seat_number && `Carteira ${c.seat_number}`, c.seat && `Carteira ${c.seat}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {c.pcd_type && c.pcd_type !== 'NORMAL' && <Badge variant="secondary">{c.pcd_type}</Badge>}
                  </div>
                ))}
                {candidates.length === 0 && <p className="p-4 text-muted-foreground">Nenhum candidato disponível para geração de etiquetas.</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Vincular fiscais */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Vincular fiscais</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Função *</Label>
              <Select value={roleValue} onValueChange={setRoleValue}>
                <SelectTrigger><SelectValue placeholder="Selecione a função" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name} — R$ {Number(r.pay_value).toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Input
                value={searchFiscal}
                onChange={(e) => setSearchFiscal(e.target.value)}
                placeholder="Buscar fiscal..."
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {visibleCollaborators.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">Nenhum fiscal encontrado.</p>
              ) : visibleCollaborators.map((c: any) => (
                <Button
                  key={c.id}
                  type="button"
                  variant={selected.includes(c.id) ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelected(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                >
                  {c.full_name}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={linkFiscals} disabled={!selected.length || !roleValue}>Vincular {selected.length || ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avaliar */}

      <Dialog open={!!replacementTarget} onOpenChange={(open) => !open && setReplacementTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Substituir {replacementTarget?.collaborator_name}</DialogTitle></DialogHeader>
          {replacementData && <div className="space-y-3">
            <div><Label>Novo fiscal ativo</Label><Select value={replacementFiscalId} onValueChange={setReplacementFiscalId}><SelectTrigger><SelectValue placeholder="Buscar por nome, e-mail, instituição ou setor" /></SelectTrigger><SelectContent>
              {replacementCandidates.map((candidate: any) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.full_name} · {[candidate.email, candidate.institution, candidate.sector].filter(Boolean).join(' · ')}</SelectItem>)}
            </SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Cargo</Label><Input value={replacementData.role_name || ''} onChange={(e) => setReplacementData({ ...replacementData, role_name: e.target.value })} /></div><div><Label>Horário</Label><Input value={replacementData.work_schedule || ''} onChange={(e) => setReplacementData({ ...replacementData, work_schedule: e.target.value })} /></div></div>
            <div className="grid grid-cols-3 gap-3"><div><Label>Unidade</Label><Input value={replacementData.unit || ''} onChange={(e) => setReplacementData({ ...replacementData, unit: e.target.value })} /></div><div><Label>Andar</Label><Input value={replacementData.floor || ''} onChange={(e) => setReplacementData({ ...replacementData, floor: e.target.value })} /></div><div><Label>Sala</Label><Input value={replacementData.room || ''} onChange={(e) => setReplacementData({ ...replacementData, room: e.target.value })} /></div></div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setReplacementTarget(null)}>Cancelar</Button><Button onClick={submitReplacement} disabled={!replacementFiscalId || confirmationActions.replace.isPending}>Confirmar substituição</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!evalTarget} onOpenChange={(o) => !o && setEvalTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Avaliar {evalTarget?.collaborator_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PsCriteriaFields values={criteria} onChange={setCriteria} />
            <div><Label>Comentários</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEvalTarget(null)}>Cancelar</Button>
            <Button onClick={submitEvaluation} disabled={saveEval.isPending}>Salvar avaliação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importar planilha da equipe */}
      <PsEventTeamImportDialog eventId={id!} open={importOpen} onOpenChange={setImportOpen} />

      {/* Editar item importado */}
      <Dialog open={!!editLink} onOpenChange={(o) => !o && setEditLink(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Editar dados no evento</DialogTitle></DialogHeader>
          {editLink && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editLink.collaborator_name || ''} onChange={(e) => setEditLink({ ...editLink, collaborator_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Função</Label><Input value={editLink.role_name || ''} onChange={(e) => setEditLink({ ...editLink, role_name: e.target.value })} /></div>
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={editLink.pay_value ?? 0} onChange={(e) => setEditLink({ ...editLink, pay_value: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Prédio</Label><Input value={editLink.building || ''} onChange={(e) => setEditLink({ ...editLink, building: e.target.value })} /></div>
                <div><Label>Andar</Label><Input value={editLink.floor || ''} onChange={(e) => setEditLink({ ...editLink, floor: e.target.value })} /></div>
                <div><Label>Sala</Label><Input value={editLink.room || ''} onChange={(e) => setEditLink({ ...editLink, room: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Setor</Label><Input value={editLink.sector || ''} onChange={(e) => setEditLink({ ...editLink, sector: e.target.value })} /></div>
                <div><Label>Unidade</Label><Input value={editLink.unit || ''} onChange={(e) => setEditLink({ ...editLink, unit: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>E-mail</Label><Input value={editLink.email || ''} onChange={(e) => setEditLink({ ...editLink, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editLink.phone || ''} onChange={(e) => setEditLink({ ...editLink, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PIX</Label><Input value={editLink.pix || ''} onChange={(e) => setEditLink({ ...editLink, pix: e.target.value })} /></div>
                <div><Label>Depósito</Label><Input value={editLink.deposit_info || ''} onChange={(e) => setEditLink({ ...editLink, deposit_info: e.target.value })} /></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLink(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                update.mutate({
                  id: editLink.id,
                  collaborator_name: editLink.collaborator_name,
                  role_name: editLink.role_name,
                  pay_value: Number(editLink.pay_value) || 0,
                  building: editLink.building || null,
                  floor: editLink.floor || null,
                  room: editLink.room || null,
                  sector: editLink.sector || null,
                  unit: editLink.unit || null,
                  email: editLink.email || null,
                  phone: editLink.phone || null,
                  pix: editLink.pix || null,
                  deposit_info: editLink.deposit_info || null,
                });
                setEditLink(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
