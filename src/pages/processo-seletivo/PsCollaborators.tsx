import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Trash2, Pencil, Star, Download, Copy, X } from 'lucide-react';
import {
  usePsCollaborators, usePsCollaboratorMutations, usePsRoles, usePsEvaluations,
  usePsFiscalBankApplications, usePsFiscalBankConfig, usePsSaveFiscalBankConfig,
} from '@/hooks/useProcessoSeletivo';
import { PS_CLASSIFICATION_LABEL, psClassification } from '@/lib/psConstants';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const empty = {
  full_name: '', cpf: '', matricula: '', email: '', phone: '', sector: '', position: '',
  preferred_role: '', notes: '', active: true,
};

export default function PsCollaborators() {
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { data: evaluations = [] } = usePsEvaluations();
  const { save, remove } = usePsCollaboratorMutations();
  const { data: applications = [] } = usePsFiscalBankApplications();
  const { data: config } = usePsFiscalBankConfig();
  const saveConfig = usePsSaveFiscalBankConfig();

  const [search, setSearch] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [newDate, setNewDate] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const dates: string[] = (config as any)?.datas || [];
  const label = (config as any)?.data_indisponivel_label || 'Não tenho disponibilidade';
  const persist = (patch: any) =>
    saveConfig.mutate({ id: (config as any)?.id, datas: dates, data_indisponivel_label: label, ...patch });

  const ranked = useMemo(
    () =>
      collaborators
        .map((c: any) => {
          const evs = evaluations.filter((e: any) => e.collaborator_id === c.id);
          return {
            ...c,
            evaluations_count: evs.length,
            events_evaluated: new Set(evs.map((e: any) => e.event_id).filter(Boolean)).size,
            classification: psClassification(Number(c.average_rating || 0)),
          };
        })
        .sort((a: any, b: any) => Number(b.average_rating) - Number(a.average_rating)),
    [collaborators, evaluations],
  );

  const filtered = ranked.filter((c: any) =>
    [c.full_name, c.cpf, c.matricula, c.email, c.sector].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()),
  );

  const filteredApps = applications.filter((a: any) =>
    [a.nome_completo, a.email, a.setor, a.instituto].filter(Boolean).join(' ').toLowerCase().includes(appSearch.toLowerCase()),
  );

  const submit = async () => {
    if (!form.full_name) return;
    await save.mutateAsync(form);
    setOpen(false);
    setForm(empty);
  };

  const exportCollaborators = () => {
    const rows = filtered.map((c: any, i: number) => ({
      Posição: i + 1,
      Nome: c.full_name,
      CPF: c.cpf || '',
      'E-mail': c.email || '',
      Telefone: c.phone || '',
      Setor: c.sector || '',
      'Nota média': Number(c.average_rating || 0).toFixed(2),
      Classificação: PS_CLASSIFICATION_LABEL[c.classification],
      'Eventos atuados': c.total_events || 0,
      Avaliações: c.evaluations_count,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Colaboradores');
    XLSX.writeFile(wb, 'colaboradores-processo-seletivo.xlsx');
  };

  const exportApplications = () => {
    const rows = filteredApps.map((a: any) => ({
      Nome: a.nome_completo,
      'E-mail': a.email,
      Telefone: a.telefone_contato,
      Instituto: a.instituto,
      Setor: a.setor,
      Funções: (a.funcoes_com_conforto || []).join(', '),
      Disponibilidade: (a.datas_disponibilidade || []).join(', '),
      Observações: a.observacoes || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Inscrições');
    XLSX.writeFile(wb, 'inscricoes-banco-de-fiscais.xlsx');
  };

  const publicUrl = `${window.location.origin}/ps/banco-fiscais`;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Colaboradores</h1>
            <p className="text-muted-foreground">Cadastro único de fiscais, desempenho e inscrições públicas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCollaborators}><Download className="mr-2 h-4 w-4" />Exportar</Button>
            <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo</Button>
          </div>
        </div>

        <Tabs defaultValue="lista">
          <TabsList className="flex-wrap">
            <TabsTrigger value="lista">Cadastro ({collaborators.length})</TabsTrigger>
            <TabsTrigger value="inscricoes">Inscrições públicas ({applications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4 pt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome, CPF, matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <p className="text-sm text-muted-foreground">
              A lista já é o ranking: ordenada pela nota média das avaliações de todos os eventos.
              Colaboradores da equipe são criados automaticamente ao importar a planilha dentro de cada evento.
            </p>
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {filtered.map((c: any, i: number) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            `${c.total_events || 0} eventos`,
                            `${c.evaluations_count} avaliações`,
                            c.sector,
                            c.phone,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[c.classification]}</Badge>
                      <Badge className="gap-1"><Star className="h-3 w-3" />{Number(c.average_rating || 0).toFixed(2)}</Badge>
                      <Button size="sm" variant="outline" onClick={() => { const { evaluations_count, events_evaluated, classification, ...rest } = c; setForm(rest); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Excluir colaborador?')) remove.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <p className="p-4 text-muted-foreground">Nenhum colaborador encontrado.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inscricoes" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar inscrito..." value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Link copiado!'); }}>
                <Copy className="mr-2 h-4 w-4" />Link público
              </Button>
              <Button variant="outline" onClick={exportApplications}><Download className="mr-2 h-4 w-4" />Exportar</Button>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {filteredApps.map((a: any) => (
                  <div key={a.id} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{a.email} · {a.telefone_contato} · {a.instituto} / {a.setor}</p>
                      </div>
                      <Badge variant="secondary">{(a.datas_disponibilidade || []).length} datas</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(a.funcoes_com_conforto || []).map((f: string) => <Badge key={f} variant="outline">{f}</Badge>)}
                    </div>
                    {a.observacoes && <p className="text-sm text-muted-foreground">{a.observacoes}</p>}
                  </div>
                ))}
                {filteredApps.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma inscrição encontrada.</p>}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Datas do formulário público</CardTitle>
                <CardDescription>Datas exibidas para quem se inscreve pelo link público.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Ex.: 15/03/2026 - Manhã" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  <Button onClick={() => { if (!newDate.trim()) return; persist({ datas: [...dates, newDate.trim()] }); setNewDate(''); }}>
                    <Plus className="mr-2 h-4 w-4" />Adicionar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dates.map((d) => (
                    <Badge key={d} variant="secondary" className="gap-1">
                      {d}
                      <button type="button" onClick={() => persist({ datas: dates.filter((x) => x !== d) })}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                  {dates.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma data cadastrada.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Rótulo da opção "sem disponibilidade"</Label>
                  <Input defaultValue={label} onBlur={(e) => e.target.value !== label && persist({ data_indisponivel_label: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Identidade</Label><Input value={form.identity_doc || ''} onChange={(e) => setForm({ ...form, identity_doc: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Unidade</Label><Input value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div><Label>Setor</Label><Input value={form.sector || ''} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Instituição</Label><Input value={form.institution || ''} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
              <div><Label>PIX</Label><Input value={form.pix || ''} onChange={(e) => setForm({ ...form, pix: e.target.value })} /></div>
            </div>
            <div>
              <Label>Função preferencial</Label>
              <Select value={form.preferred_role || ''} onValueChange={(v) => setForm({ ...form, preferred_role: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
