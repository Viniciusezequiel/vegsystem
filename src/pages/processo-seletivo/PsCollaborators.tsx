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
import { Plus, Search, Pencil, Star, Download, Copy, X, History, Upload } from 'lucide-react';
import {
  usePsCollaborators, usePsCollaboratorMutations, usePsRoles, usePsEvaluations,
  usePsFiscalBankApplications, usePsFiscalBankConfig, usePsSaveFiscalBankConfig,
  usePsCollaboratorParticipations, usePsImportFiscalBank,
} from '@/hooks/useProcessoSeletivo';
import { PS_CLASSIFICATION_LABEL, psClassification } from '@/lib/psConstants';
import {
  dedupeFiscalRows,
  extractFiscalImportedHistory,
  normalizeFiscalEmail,
  normalizeFiscalInstitution,
  normalizeFiscalMatricula,
  normalizeFiscalImportNote,
} from '@/lib/psFiscalBank.mjs';
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
  const { save } = usePsCollaboratorMutations();
  const { data: participations = [] } = usePsCollaboratorParticipations();
  const { data: applications = [] } = usePsFiscalBankApplications();
  const { data: config } = usePsFiscalBankConfig();
  const saveConfig = usePsSaveFiscalBankConfig();
  const importFiscalBank = usePsImportFiscalBank();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('active');
  const [historyFiscal, setHistoryFiscal] = useState<any>(null);
  const [appSearch, setAppSearch] = useState('');
  const [newDate, setNewDate] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [importFiscalOpen, setImportFiscalOpen] = useState(false);
  const [fiscalImportRows, setFiscalImportRows] = useState<any[]>([]);
  const [fiscalImportPreview, setFiscalImportPreview] = useState<any>(null);
  const [profileFiscal, setProfileFiscal] = useState<any>(null);

  const dates: string[] = (config as any)?.datas || [];
  const label = (config as any)?.data_indisponivel_label || 'Não tenho disponibilidade';
  const persist = (patch: any) =>
    saveConfig.mutate({ id: (config as any)?.id, datas: dates, data_indisponivel_label: label, ...patch });

  const ranked = useMemo(
    () =>
      collaborators
        .map((c: any) => {
          const evs = evaluations.filter((e: any) => e.collaborator_id === c.id);
          const history = participations.filter((item: any) => item.collaborator_id === c.id);
          return {
            ...c,
            history,
            participation_count: history.length,
            evaluations_count: evs.length,
            events_evaluated: new Set(evs.map((e: any) => e.event_id).filter(Boolean)).size,
            classification: psClassification(Number(c.average_rating || 0)),
          };
        })
        .sort((a: any, b: any) => Number(b.average_rating) - Number(a.average_rating)),
    [collaborators, evaluations, participations],
  );

  const filtered = ranked.filter((c: any) => {
    const matchesStatus = activeFilter === 'all' || (activeFilter === 'active' ? c.active : !c.active);
    return matchesStatus && [c.full_name, c.matricula, c.email, c.institution, c.sector]
      .filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase());
  });

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

  const pickFiscalCell = (row: Record<string, any>, keys: string[]) => {
    const normalized = Object.keys(row || {}).map((key) => ({ key, value: row[key] }));
    for (const key of keys) {
      const found = normalized.find((entry) => entry.key.trim().toLowerCase() === key.toLowerCase());
      if (found && String(found.value ?? '').trim()) return String(found.value).trim();
    }
    return '';
  };

  const parseImportedHistory = (row: Record<string, any>) => {
    const selection = pickFiscalCell(row, ['Nº DE SELEÇÕES', 'N DE SELECOES', 'NUMERO DE SELECOES', 'SELECOES', 'SELEÇÕES']);
    const participation = pickFiscalCell(row, ['PARTICIPAÇÕES EM PROCESSOS SELETIVOS', 'PARTICIPACOES EM PROCESSOS SELETIVOS', 'PARTICIPAÇÕES', 'PARTICIPACOES']);
    const notes = pickFiscalCell(row, ['OBSERVAÇÃO', 'OBSERVACOES', 'OBSERVACOES HISTORICAS', 'OBSERVAÇÕES', 'OBSERVACOES HISTORICAS']);
    const normalized = {
      selection_count: Number(String(selection).replace(/[^0-9]/g, '')) || 0,
      participation_count: Number(String(participation).replace(/[^0-9]/g, '')) || 0,
      observations: normalizeFiscalImportNote(notes),
    };
    const noteText = normalized.observations || '';
    return { ...normalized, noteText };
  };

  const readFiscalBankFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]] ?? {}, { defval: '' }) as any[];
      const rows = rawRows
        .map((row: any) => {
          const full_name = pickFiscalCell(row, ['NOME', 'Nome', 'NOME COMPLETO']) || '';
          const cpf = pickFiscalCell(row, ['CPF']) || '';
          const email = pickFiscalCell(row, ['E-MAIL', 'EMAIL']) || '';
          const phone = pickFiscalCell(row, ['CELULAR', 'TELEFONE']) || '';
          const institution = pickFiscalCell(row, ['INSTITUTO', 'INSTITUIÇÃO', 'INSTITUICAO']) || '';
          const sector = pickFiscalCell(row, ['SETOR']) || '';
          const role = pickFiscalCell(row, ['CARGO SUGERIDO', 'CARGO', 'FUNÇÃO', 'FUNCAO']) || '';
          const unit = pickFiscalCell(row, ['UNIDADE DE ATUAÇÃO', 'UNIDADE', 'UNIDADE DE TRABALHO']) || '';
          const notes = pickFiscalCell(row, ['OBSERVAÇÃO', 'OBSERVACOES', 'OBSERVACOES HISTORICAS', 'OBSERVAÇÕES']) || '';
          const matricula = pickFiscalCell(row, ['MATRICULA', 'MATRÍCULA']) || '';
          const importedHistory = parseImportedHistory(row);
          return {
            full_name: full_name.trim(),
            cpf: cpf.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            institution: institution.trim() || null,
            sector: sector.trim() || null,
            role: role.trim() || null,
            unit: unit.trim() || null,
            notes: importedHistory.noteText || notes.trim() || null,
            matricula: matricula.trim() || null,
            imported_history: importedHistory.noteText || notes.trim() || null,
            imported_selection_count: importedHistory.selection_count || 0,
            imported_participation_count: importedHistory.participation_count || 0,
          };
        })
        .filter((row) => row.full_name || row.email || row.matricula || row.cpf);

      const prepared = dedupeFiscalRows(rows.map((row) => ({
        full_name: row.full_name,
        email: normalizeFiscalEmail(row.email),
        matricula: normalizeFiscalMatricula(row.matricula),
        institution: normalizeFiscalInstitution(row.institution),
        phone: row.phone,
        role: row.role,
        unit: row.unit,
        sector: row.sector,
        notes: row.notes,
        imported_history: row.imported_history,
        imported_selection_count: row.imported_selection_count,
        imported_participation_count: row.imported_participation_count,
      })));

      const emailMap = new Map((collaborators || []).filter((c: any) => c.email_normalized).map((c: any) => [c.email_normalized, c]));
      const matriculaMap = new Map((collaborators || []).filter((c: any) => c.matricula_normalized && c.institution_normalized).map((c: any) => [`${c.matricula_normalized}|${c.institution_normalized}`, c]));

      let existing = 0;
      let updates = 0;
      let newCount = 0;
      let inconsistent = 0;
      let ignored = 0;

      for (const row of prepared) {
        const emailKey = normalizeFiscalEmail(row.email);
        const matriculaKey = normalizeFiscalMatricula(row.matricula);
        const institutionKey = normalizeFiscalInstitution(row.institution);
        const matchesEmail = !!(emailKey && emailMap.has(emailKey));
        const matchesMatricula = !!(matriculaKey && institutionKey && matriculaMap.has(`${matriculaKey}|${institutionKey}`));

        if (!row.full_name || (!emailKey && !matriculaKey)) {
          inconsistent += 1;
          continue;
        }

        if (!row.full_name && !emailKey && !matriculaKey) {
          ignored += 1;
          continue;
        }

        if (matchesEmail || matchesMatricula) {
          existing += 1;
          const hasMore = Object.values({
            email: row.email,
            matricula: row.matricula,
            institution: row.institution,
            sector: row.sector,
            unit: row.unit,
            role: row.role,
            notes: row.notes,
          }).some((value) => value != null && String(value).trim() !== '');
          if (hasMore) updates += 1;
        } else {
          newCount += 1;
        }
      }

      const plan = {
        rows: rawRows.length,
        existing,
        new: newCount,
        updates,
        duplicates: Math.max(0, rows.length - prepared.length),
        inconsistent,
        ignored,
        historicalNotes: prepared.filter((row) => row.notes).length,
        rowsPreview: prepared.slice(0, 8),
      };

      setFiscalImportRows(prepared);
      setFiscalImportPreview(plan);
      setImportFiscalOpen(true);
    } catch (error: any) {
      toast.error(`Não foi possível ler a planilha do Banco de Fiscais: ${error.message}`);
    }
  };

  const confirmFiscalImport = async () => {
    if (!fiscalImportRows.length) return;
    await importFiscalBank.mutateAsync(fiscalImportRows);
    setImportFiscalOpen(false);
    setFiscalImportRows([]);
    setFiscalImportPreview(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Colaboradores</h1>
            <p className="text-muted-foreground">Cadastro único de fiscais, desempenho e inscrições públicas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo fiscal</Button>
            <Button variant="outline" onClick={() => setImportFiscalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />Importar Banco de Fiscais
            </Button>
            <Button variant="outline" onClick={exportCollaborators}><Download className="mr-2 h-4 w-4" />Exportar</Button>
          </div>
        </div>

        <Tabs defaultValue="lista">
          <TabsList className="flex-wrap">
            <TabsTrigger value="lista">Cadastro ({collaborators.length})</TabsTrigger>
            <TabsTrigger value="inscricoes">Inscrições públicas ({applications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4 pt-4">
            <div className="flex max-w-2xl gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por nome, e-mail, matrícula ou instituição..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
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
                            `${c.participation_count} atuações`,
                            `${c.evaluations_count} avaliações`,
                            c.sector,
                            c.phone,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge>
                      <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[c.classification]}</Badge>
                      <Badge className="gap-1"><Star className="h-3 w-3" />{Number(c.average_rating || 0).toFixed(2)}</Badge>
                      <Button size="sm" variant="outline" onClick={() => {
                        const { evaluations_count, events_evaluated, classification, history, participation_count, ...rest } = c;
                        setForm(rest); setOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setProfileFiscal(c)} title="Perfil do fiscal">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setHistoryFiscal(c)} title="Histórico"><History className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => save.mutate({ id: c.id, active: !c.active })}>
                        {c.active ? 'Inativar' : 'Ativar'}
                      </Button>
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

      <Dialog open={importFiscalOpen} onOpenChange={(value) => {
        setImportFiscalOpen(value);
        if (!value) {
          setFiscalImportRows([]);
          setFiscalImportPreview(null);
        }
      }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Importar Banco de Fiscais</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && readFiscalBankFile(e.target.files[0])}
                />
                Selecionar planilha
              </label>
            </div>

            <p className="text-sm text-muted-foreground">
              As colunas principais mapeadas são: NOME, CPF, E-MAIL, CELULAR, INSTITUTO, SETOR, CARGO, UNIDADE DE ATUAÇÃO, SALA e OBSERVAÇÃO.
              A reconciliação prioriza e-mail institucional; em seguida, matrícula + instituição; nome e CPF não fazem merge automático.
            </p>

            {fiscalImportPreview && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Linhas</p><p className="text-xl font-bold">{fiscalImportPreview.rows}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Existentes</p><p className="text-xl font-bold">{fiscalImportPreview.existing}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Novos</p><p className="text-xl font-bold">{fiscalImportPreview.new}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Atualizações</p><p className="text-xl font-bold">{fiscalImportPreview.updates}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Duplicados</p><p className="text-xl font-bold">{fiscalImportPreview.duplicates}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Inconsistentes</p><p className="text-xl font-bold">{fiscalImportPreview.inconsistent}</p></CardContent></Card>
                </div>

                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">Resumo</p>
                  <p className="text-muted-foreground">Ignorados: {fiscalImportPreview.ignored}</p>
                  <p className="text-muted-foreground">Notas históricas: {fiscalImportPreview.historicalNotes}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Amostra da importação</p>
                  <div className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                    {(fiscalImportPreview.rowsPreview || []).map((row: any, idx: number) => (
                      <div key={`${row.full_name}-${idx}`} className="p-2 text-sm">
                        <p className="font-medium">{row.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.email || 'sem e-mail'} · {row.institution || 'sem instituição'} · {row.role || 'sem cargo'}
                        </p>
                        {row.notes && <p className="mt-1 text-xs text-amber-700">Nota: {row.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportFiscalOpen(false)}>Cancelar</Button>
            <Button onClick={confirmFiscalImport} disabled={!fiscalImportRows.length || importFiscalBank.isPending}>
              Confirmar importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Identidade</Label><Input value={form.identity_doc || ''} onChange={(e) => setForm({ ...form, identity_doc: e.target.value })} /></div>
            </div>
            <div><Label>Matrícula</Label><Input value={form.matricula || ''} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
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

      <Dialog open={!!profileFiscal} onOpenChange={(value) => !value && setProfileFiscal(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Perfil do fiscal</DialogTitle></DialogHeader>
          {profileFiscal && (() => {
            const importedHistory = extractFiscalImportedHistory(profileFiscal.notes || '');
            return (
              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Cadastro</p>
                  <p className="mt-2 font-semibold">{profileFiscal.full_name}</p>
                  <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <span>{profileFiscal.email || 'Sem e-mail'}</span>
                    <span>{profileFiscal.institution || 'Sem instituição'}</span>
                    <span>{profileFiscal.sector || 'Sem setor'}</span>
                    <span>{profileFiscal.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Histórico</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Seleções anteriores/importadas</p><p className="text-xl font-bold">{Number(profileFiscal.imported_selection_count ?? importedHistory.selection_count ?? 0)}</p></div>
                    <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Participações históricas/importadas</p><p className="text-xl font-bold">{Number(profileFiscal.imported_participation_count ?? importedHistory.participation_count ?? 0)}</p></div>
                    <div className="rounded-lg bg-muted p-2"><p className="text-xs text-muted-foreground">Atuações registradas no VEG</p><p className="text-xl font-bold">{profileFiscal.participation_count || 0}</p></div>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs uppercase text-muted-foreground">Observações / avaliações</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{profileFiscal.notes || 'Nenhuma observação importada.'}</p>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {profileFiscal.evaluations_count ? `Avaliações registradas: ${profileFiscal.evaluations_count}` : 'Nenhuma avaliação registrada.'}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFiscal} onOpenChange={(value) => !value && setHistoryFiscal(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de {historyFiscal?.full_name}</DialogTitle></DialogHeader>
          <div className="divide-y rounded-lg border">
            {(historyFiscal?.history || []).map((item: any) => (
              <div key={item.id} className="p-3 text-sm">
                <p className="font-medium">{item.ps_events?.name || 'Evento'}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.ps_events?.date, item.role_name || item.assigned_role,
                    item.absent ? 'Ausente' : item.present ? 'Presente' : 'Sem confirmação'].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {!historyFiscal?.history?.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma atuação vinculada.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
