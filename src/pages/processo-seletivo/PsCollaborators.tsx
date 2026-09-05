import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Copy,
  Download,
  History,
  Pencil,
  Plus,
  Search,
  Star,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageToolbar } from '@/components/layout/PageToolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  usePsCollaborators,
  usePsCollaboratorMutations,
  usePsRoles,
  usePsEvaluations,
  usePsFiscalBankApplications,
  usePsFiscalBankConfig,
  usePsSaveFiscalBankConfig,
  usePsCollaboratorParticipations,
  usePsImportFiscalBank,
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
      <PageHeader
        title="Colaboradores"
        description="Cadastro único de fiscais, ranking de desempenho, histórico e inscrições do banco público."
        actions={
          <>
            <Button size="sm" onClick={() => { setForm(empty); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Novo fiscal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportFiscalOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Banco
            </Button>
            <Button variant="outline" size="sm" onClick={exportCollaborators}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </>
        }
      />

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl border border-border/60 bg-muted/25 p-1 sm:w-[420px]">
          <TabsTrigger value="lista">Cadastro ({collaborators.length})</TabsTrigger>
          <TabsTrigger value="inscricoes">Inscrições ({applications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="mt-0 space-y-4">
          <PageToolbar className="mb-0">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome, e-mail, matrícula ou instituição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PageToolbar>

          <div className="flex flex-col gap-1 px-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{filtered.length} {filtered.length === 1 ? 'fiscal encontrado' : 'fiscais encontrados'}</span>
            <span>Ranking ordenado pela nota média consolidada das avaliações.</span>
          </div>

          {filtered.length === 0 ? (
            <ContentState
              icon={UserRound}
              title="Nenhum colaborador encontrado"
              description="Ajuste os filtros ou cadastre um novo fiscal."
            />
          ) : (
            <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
              <CardContent className="divide-y divide-border/50 p-0">
                {filtered.map((c: any, i: number) => (
                  <div key={c.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/15 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{c.full_name}</p>
                          <Badge variant={c.active ? 'default' : 'secondary'} className="text-[10px]">{c.active ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {[
                            `${c.participation_count} atuações`,
                            `${c.evaluations_count} avaliações`,
                            c.sector,
                            c.phone,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Badge variant="secondary" className="text-[10px]">{PS_CLASSIFICATION_LABEL[c.classification]}</Badge>
                      <Badge className="gap-1 text-[10px]"><Star className="h-3 w-3" />{Number(c.average_rating || 0).toFixed(2)}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const { evaluations_count, events_evaluated, classification, history, participation_count, ...rest } = c;
                          setForm(rest);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setProfileFiscal(c)}>Perfil</Button>
                      <Button size="sm" variant="outline" onClick={() => setHistoryFiscal(c)}>
                        <History className="mr-1.5 h-3.5 w-3.5" />Histórico
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => save.mutate({ id: c.id, active: !c.active })}>
                        {c.active ? 'Inativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="inscricoes" className="mt-0 space-y-4">
          <PageToolbar className="mb-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar inscrito..." value={appSearch} onChange={(e) => setAppSearch(e.target.value)} />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(publicUrl);
                  toast.success('Link copiado!');
                }}
              >
                <Copy className="mr-2 h-4 w-4" />Link público
              </Button>
              <Button variant="outline" size="sm" onClick={exportApplications}>
                <Download className="mr-2 h-4 w-4" />Exportar inscrições
              </Button>
            </div>
          </PageToolbar>

          {filteredApps.length === 0 ? (
            <ContentState icon={UserRound} title="Nenhuma inscrição encontrada" description="As inscrições recebidas pelo formulário público aparecerão aqui." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredApps.map((a: any) => (
                <Card key={a.id} className="border-border/60 bg-card/65 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.nome_completo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{a.email} · {a.telefone_contato}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.instituto} / {a.setor}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">{(a.datas_disponibilidade || []).length} datas</Badge>
                    </div>
                    {(a.funcoes_com_conforto || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(a.funcoes_com_conforto || []).map((f: string) => <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>)}
                      </div>
                    )}
                    {a.observacoes && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{a.observacoes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="border-border/60 bg-card/65 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Datas do formulário público</CardTitle>
              <CardDescription>Datas exibidas para quem se inscreve pelo link público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder="Ex.: 15/03/2026 - Manhã" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                <Button
                  className="shrink-0"
                  onClick={() => {
                    if (!newDate.trim()) return;
                    persist({ datas: [...dates, newDate.trim()] });
                    setNewDate('');
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />Adicionar
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {dates.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1.5 py-1">
                    {d}
                    <button type="button" aria-label={`Remover ${d}`} onClick={() => persist({ datas: dates.filter((x) => x !== d) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {dates.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma data cadastrada.</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Rótulo da opção “sem disponibilidade”</Label>
                <Input defaultValue={label} onBlur={(e) => e.target.value !== label && persist({ data_indisponivel_label: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={importFiscalOpen} onOpenChange={(value) => {
        setImportFiscalOpen(value);
        if (!value) {
          setFiscalImportRows([]);
          setFiscalImportPreview(null);
        }
      }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>Importar Banco de Fiscais</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-3 text-sm transition-colors hover:border-primary/35 hover:bg-muted/25">
              <span className="flex items-center gap-2"><Upload className="h-4 w-4 text-primary" />Selecionar planilha</span>
              <span className="text-xs text-muted-foreground">.xlsx, .xls ou .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && readFiscalBankFile(e.target.files[0])} />
            </label>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-xs leading-relaxed text-muted-foreground">
              As colunas principais mapeadas são NOME, CPF, E-MAIL, CELULAR, INSTITUTO, SETOR, CARGO, UNIDADE DE ATUAÇÃO, SALA e OBSERVAÇÃO. A reconciliação prioriza <strong className="text-foreground">e-mail institucional</strong>; em seguida, <strong className="text-foreground">matrícula + instituição</strong>. Nome e CPF não fazem merge automático.
            </div>

            {fiscalImportPreview && (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ['Linhas', fiscalImportPreview.rows],
                    ['Existentes', fiscalImportPreview.existing],
                    ['Novos', fiscalImportPreview.new],
                    ['Atualizações', fiscalImportPreview.updates],
                    ['Duplicados', fiscalImportPreview.duplicates],
                    ['Inconsistentes', fiscalImportPreview.inconsistent],
                  ].map(([title, value]) => (
                    <div key={String(title)} className="rounded-lg border border-border/60 bg-card/70 p-3">
                      <p className="text-[10px] text-muted-foreground">{title}</p>
                      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  <span>Ignorados: <strong className="text-foreground">{fiscalImportPreview.ignored}</strong></span>
                  <span>Notas históricas: <strong className="text-foreground">{fiscalImportPreview.historicalNotes}</strong></span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amostra da importação</p>
                  <div className="max-h-56 divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60">
                    {(fiscalImportPreview.rowsPreview || []).map((row: any, idx: number) => (
                      <div key={`${row.full_name}-${idx}`} className="p-3 text-sm">
                        <p className="font-medium">{row.full_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.email || 'sem e-mail'} · {row.institution || 'sem instituição'} · {row.role || 'sem cargo'}</p>
                        {row.notes && <p className="mt-1 text-xs text-warning">Nota: {row.notes}</p>}
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
              {importFiscalBank.isPending ? 'Importando...' : 'Confirmar importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">CPF</Label><Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Identidade</Label><Input value={form.identity_doc || ''} onChange={(e) => setForm({ ...form, identity_doc: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Matrícula</Label><Input value={form.matricula || ''} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">E-mail</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Telefone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Unidade</Label><Input value={form.unit || ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Setor</Label><Input value={form.sector || ''} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Instituição</Label><Input value={form.institution || ''} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">PIX</Label><Input value={form.pix || ''} onChange={(e) => setForm({ ...form, pix: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Função preferencial</Label>
              <Select value={form.preferred_role || ''} onValueChange={(v) => setForm({ ...form, preferred_role: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Observações</Label><Textarea rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!profileFiscal} onOpenChange={(value) => !value && setProfileFiscal(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Perfil do fiscal</DialogTitle></DialogHeader>
          {profileFiscal && (() => {
            const importedHistory = extractFiscalImportedHistory(profileFiscal.notes || '');
            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cadastro</p>
                  <p className="mt-2 text-base font-semibold">{profileFiscal.full_name}</p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>{profileFiscal.email || 'Sem e-mail'}</span>
                    <span>{profileFiscal.institution || 'Sem instituição'}</span>
                    <span>{profileFiscal.sector || 'Sem setor'}</span>
                    <span>{profileFiscal.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Histórico</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      ['Seleções importadas', Number(profileFiscal.imported_selection_count ?? importedHistory.selection_count ?? 0)],
                      ['Participações importadas', Number(profileFiscal.imported_participation_count ?? importedHistory.participation_count ?? 0)],
                      ['Atuações no VEG', profileFiscal.participation_count || 0],
                    ].map(([title, value]) => (
                      <div key={String(title)} className="rounded-lg bg-muted/35 p-2.5">
                        <p className="text-[10px] text-muted-foreground">{title}</p>
                        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Observações / avaliações</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{profileFiscal.notes || 'Nenhuma observação importada.'}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{profileFiscal.evaluations_count ? `Avaliações registradas: ${profileFiscal.evaluations_count}` : 'Nenhuma avaliação registrada.'}</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFiscal} onOpenChange={(value) => !value && setHistoryFiscal(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Histórico de {historyFiscal?.full_name}</DialogTitle></DialogHeader>
          <div className="divide-y divide-border/50 rounded-xl border border-border/60">
            {(historyFiscal?.history || []).map((item: any) => (
              <div key={item.id} className="p-3 text-sm">
                <p className="font-medium">{item.ps_events?.name || 'Evento'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[item.ps_events?.date, item.role_name || item.assigned_role,
                    item.absent ? 'Ausente' : item.present ? 'Presente' : 'Sem confirmação'].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
            {!historyFiscal?.history?.length && <p className="p-4 text-sm text-muted-foreground">Nenhuma atuação vinculada.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
