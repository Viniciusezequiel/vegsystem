import { useState } from 'react';
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
import {
  usePsEvent, usePsEventMutations, usePsEventCollaborators, usePsEventCollaboratorMutations,
  usePsCollaborators, usePsRoles, usePsEvaluations, usePsSaveEvaluation, usePsCandidates,
  usePsCandidateMutations, usePsSelfEvaluations, usePsClearEventTeam,
} from '@/hooks/useProcessoSeletivo';
import { useAuth } from '@/contexts/AuthContext';
import { PS_EVENT_STATUS, PS_CLASSIFICATION_LABEL, PS_PCD_OPTIONS } from '@/lib/psConstants';
import { ArrowLeft, Plus, Trash2, Copy, Download, CheckCircle2, Upload, Star, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function PsEventDetail() {
  const { id } = useParams();
  const { data: event } = usePsEvent(id);
  const { finalize } = usePsEventMutations();
  const { data: links = [] } = usePsEventCollaborators(id);
  const { add, update, remove } = usePsEventCollaboratorMutations(id);
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { data: evaluations = [] } = usePsEvaluations(id);
  const { data: selfEvaluations = [] } = usePsSelfEvaluations(id);
  const saveEval = usePsSaveEvaluation();
  const { data: candidates = [] } = usePsCandidates(id);
  const { addMany, removeAll } = usePsCandidateMutations();
  const { profile } = useAuth();
  const clearTeam = usePsClearEventTeam();

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLink, setEditLink] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [roleValue, setRoleValue] = useState('');
  const [evalTarget, setEvalTarget] = useState<any>(null);
  const [criteria, setCriteria] = useState(emptyCriteria());
  const [comments, setComments] = useState('');

  const publicBase = `${window.location.origin}/ps`;

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
      event_name: event?.name,
      collaborator_id: evalTarget.collaborator_id,
      collaborator_name: evalTarget.collaborator_name,
      role_name: evalTarget.role_name,
      evaluator_name: profile?.full_name || 'Sistema',
      comments,
      ...criteria,
    });
    setEvalTarget(null);
    setCriteria(emptyCriteria());
    setComments('');
  };

  const importCandidates = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const mapped = rows.map((r) => ({
      event_id: id,
      full_name: String(r['Nome'] ?? r['NOME'] ?? r['nome'] ?? '').trim(),
      document: String(r['CPF'] ?? r['Documento'] ?? '').trim() || null,
      room: String(r['Sala'] ?? r['SALA'] ?? '').trim() || null,
      seat: String(r['Carteira'] ?? r['Assento'] ?? '').trim() || null,
      campus: String(r['Campus'] ?? '').trim() || null,
      pcd_type: String(r['PCD'] ?? r['Tipo'] ?? 'NORMAL').trim().toUpperCase() || 'NORMAL',
    })).filter((r) => r.full_name);
    if (mapped.length) addMany.mutate(mapped);
  };

  const exportPresence = () => {
    const rows = links.map((l: any) => ({
      Nome: l.collaborator_name,
      Função: l.role_name,
      Sala: l.room || '',
      Presente: l.present ? 'Sim' : 'Não',
      Ausente: l.absent ? 'Sim' : 'Não',
      Assinado: l.signature ? 'Sim' : 'Não',
      'Valor R$': Number(l.pay_value || 0).toFixed(2),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenças');
    XLSX.writeFile(wb, `presencas-${event?.name || 'evento'}.xlsx`);
  };

  if (!event) {
    return <MainLayout><p className="text-muted-foreground">Carregando evento...</p></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/admin-module/processo-seletivo/eventos"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <h1 className="text-2xl font-bold">{event.name}</h1>
              <p className="text-muted-foreground">
                {new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR')} {event.location ? `· ${event.location}` : ''}
              </p>
            </div>
            <Badge variant={event.status === 'em_andamento' ? 'default' : 'secondary'}>{PS_EVENT_STATUS[event.status]}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPresence}><Download className="mr-2 h-4 w-4" />Presenças</Button>
            {event.status !== 'finalizado' && (
              <Button onClick={() => { if (confirm('Finalizar evento?')) finalize.mutate(event.id); }}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Finalizar
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Fiscais</p><p className="text-2xl font-bold">{links.length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avaliados</p><p className="text-2xl font-bold">{links.filter((l: any) => l.evaluated).length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Candidatos</p><p className="text-2xl font-bold">{candidates.length}</p></CardContent></Card>
          <Card className="rounded-2xl"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Custo estimado</p><p className="text-2xl font-bold">R$ {totalCost.toFixed(2)}</p></CardContent></Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Links públicos</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Avaliação de fiscais', url: `${publicBase}/avaliar/${event.id}` },
              { label: 'Autoavaliação', url: `${publicBase}/autoavaliacao/${event.id}` },
              { label: 'Lista de presença/assinatura', url: `${publicBase}/presenca/${event.id}` },
            ].map((l) => (
              <Button key={l.url} variant="outline" className="justify-between" onClick={() => copy(l.url)}>
                {l.label} <Copy className="h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>

        <Tabs defaultValue="fiscais">
          <TabsList className="flex-wrap">
            <TabsTrigger value="fiscais">Fiscais</TabsTrigger>
            <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
            <TabsTrigger value="auto">Autoavaliações</TabsTrigger>
            <TabsTrigger value="candidatos">Candidatos</TabsTrigger>
          </TabsList>

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
                      {l.evaluated && <Badge variant="secondary">Avaliado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[l.role_name, `R$ ${Number(l.pay_value || 0).toFixed(2)}`, l.building, l.floor, l.room && `Sala ${l.room}`]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><Label className="text-xs">Presente</Label>
                      <Switch checked={!!l.present} onCheckedChange={(v) => update.mutate({ id: l.id, present: v })} /></div>
                    <div className="flex items-center justify-between"><Label className="text-xs">Ausente</Label>
                      <Switch checked={!!l.absent} onCheckedChange={(v) => update.mutate({ id: l.id, absent: v })} /></div>
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

          <TabsContent value="avaliacoes" className="pt-4">
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {evaluations.map((e: any) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                    <div>
                      <p className="font-medium">{e.collaborator_name}</p>
                      <p className="text-xs text-muted-foreground">{e.role_name || '-'} · por {e.evaluator_name || 'anônimo'}</p>
                      {e.comments && <p className="mt-1 text-sm text-muted-foreground">{e.comments}</p>}
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
                        {[c.campus, c.room && `Sala ${c.room}`, c.seat && `Carteira ${c.seat}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {c.pcd_type && c.pcd_type !== 'NORMAL' && <Badge variant="secondary">{c.pcd_type}</Badge>}
                  </div>
                ))}
                {candidates.length === 0 && <p className="p-4 text-muted-foreground">Nenhum candidato importado. Colunas aceitas: Nome, CPF, Campus, Sala, Carteira, PCD ({PS_PCD_OPTIONS.join('/')}).</p>}
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
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {collaborators
                .filter((c: any) => !links.some((l: any) => l.collaborator_id === c.id))
                .map((c: any) => (
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
