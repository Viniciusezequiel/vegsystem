import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, UserX } from 'lucide-react';
import {
  previewPsEventTeamImport, usePsImportEventTeam, type PsTeamImportPreview, type PsTeamImportRow,
} from '@/hooks/usePsEventTeamImport';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

/** Colunas da planilha oficial "CandidatosPagamento" */
export const PS_TEAM_COLUMNS = [
  'STATUS DE SELEÇÃO', 'NOME', 'IDENTIDADE', 'CPF', 'MATRICULA', 'EMAIL', 'TELEFONE', 'CELULAR', 'UNIDADE', 'SETOR',
  'INSTITUICAO', 'FUNCAO', 'PREDIO', 'ANDAR', 'SALA', 'HORARIO', 'ATRIBUICAO', 'VALOR', 'DEPOSITO', 'PIX',
];

const pick = (row: any, ...names: string[]) => {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((k) => k.trim().toLowerCase() === n.toLowerCase());
    if (k != null) {
      const v = row[k];
      if (v == null) return '';
      return String(v).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
};

const normalizeSelectionStatus = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const SELECTION_STATUS_COLUMNS = [
  'STATUS DE SELEÇÃO', 'STATUS DE SELECAO', 'STATUS SELEÇÃO', 'STATUS SELECAO',
  'STATUS DA SELEÇÃO', 'STATUS DA SELECAO', 'SELECIONADO', 'SELECIONADA',
];

const SELECTED_STATUSES = new Set(['sim', 'selecionado', 'selecionada', 'selecionado a', 'x', '1', 'true']);

export function parsePsEventTeamSpreadsheetRows(raw: any[]) {
  const hasSelectionColumn = raw.some((row) => Object.keys(row).some((key) =>
    SELECTION_STATUS_COLUMNS.some((column) => key.trim().localeCompare(column, 'pt-BR', { sensitivity: 'base' }) === 0)));
  let excludedBySelection = 0;

  const rows: PsTeamImportRow[] = raw
    .filter((row) => {
      if (!hasSelectionColumn) return true;
      const selected = SELECTED_STATUSES.has(normalizeSelectionStatus(pick(row, ...SELECTION_STATUS_COLUMNS)));
      if (!selected && pick(row, 'NOME', 'Nome', 'NOME COMPLETO')) excludedBySelection += 1;
      return selected;
    })
    .map((r) => ({
      full_name: pick(r, 'NOME', 'Nome', 'NOME COMPLETO'),
      identity_doc: pick(r, 'IDENTIDADE', 'RG') || null,
      cpf: pick(r, 'CPF') || null,
      matricula: pick(r, 'MATRICULA', 'MATRÍCULA') || null,
      email: pick(r, 'EMAIL', 'E-MAIL') || null,
      phone: pick(r, 'TELEFONE') || null,
      mobile: pick(r, 'CELULAR') || null,
      unit: pick(r, 'UNIDADE') || null,
      sector: pick(r, 'SETOR') || null,
      institution: pick(r, 'INSTITUICAO', 'INSTITUIÇÃO') || null,
      role_name: pick(r, 'FUNCAO', 'FUNÇÃO') || null,
      building: pick(r, 'PREDIO', 'PRÉDIO') || null,
      floor: pick(r, 'ANDAR') || null,
      room: (pick(r, 'SALA') || '').replace(/^-$/, '') || null,
      work_schedule: pick(r, 'HORARIO', 'HORÁRIO', 'HORA', 'TURNO', 'HORÁRIO DE ATUAÇÃO', 'HORARIO DE ATUACAO') || null,
      assigned_role: pick(r, 'ATRIBUICAO', 'ATRIBUIÇÃO', 'ATRIBUICAO OPERACIONAL', 'ATRIBUIÇÃO OPERACIONAL') || null,
      pay_value: Number(String(pick(r, 'VALOR')).replace(/[^\d,.-]/g, '').replace(',', '.')) || 0,
      deposit_info: pick(r, 'DEPOSITO', 'DEPÓSITO') || null,
      pix: pick(r, 'PIX') || null,
    }))
    .filter((row) => row.full_name);

  return { rows, hasSelectionColumn, excludedBySelection };
}

export function downloadTeamTemplate() {
  const example: Record<string, string> = {
    'STATUS DE SELEÇÃO': 'SIM',
    NOME: 'Maria Silva Souza',
    IDENTIDADE: 'MG-15.930.225',
    CPF: '125.404.086-21',
    MATRICULA: '123456',
    EMAIL: 'maria.souza@empresa.org.br',
    TELEFONE: '(31)3450-6660',
    CELULAR: '(31)99367-6945',
    UNIDADE: 'FUNDAÇÃO EDUCACIONAL LUCAS MACHADO - FCMMG',
    SETOR: 'RECURSOS DIDATICOS',
    INSTITUICAO: 'Faculdade Ciências Médicas-MG',
    FUNCAO: 'Fiscal de Sala (Vestibular)',
    PREDIO: 'FCM-MG (Campus I)',
    ANDAR: '4º Andar',
    SALA: '401',
    VALOR: '170',
    DEPOSITO: 'Bco: 237 Ag.: 3435-5 Conta: 0561108-3 Tipo: CORRENTE',
    PIX: '12540408621',
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: PS_TEAM_COLUMNS });
  ws['!cols'] = PS_TEAM_COLUMNS.map(() => ({ wch: 26 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  XLSX.writeFile(wb, 'modelo-importacao-colaboradores.xlsx');
}

export function PsEventTeamImportDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const importTeam = usePsImportEventTeam();
  const [preview, setPreview] = useState<PsTeamImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<PsTeamImportPreview | null>(null);
  const [planning, setPlanning] = useState(false);
  const [confirmedNames, setConfirmedNames] = useState<Record<number, string>>({});
  const [excludedBySelection, setExcludedBySelection] = useState(0);

  const readFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const raw: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const parsed = parsePsEventTeamSpreadsheetRows(raw);
      const rows = parsed.rows;
      if (!rows.length) {
        toast.error(parsed.hasSelectionColumn
          ? 'Nenhum colaborador selecionado foi encontrado. Confira a coluna Status de Seleção.'
          : 'Nenhuma linha válida encontrada. Verifique a coluna NOME.');
        return;
      }
      setFileName(file.name);
      setPreview(rows);
      setExcludedBySelection(parsed.excludedBySelection);
      setPlanning(true);
      setConfirmedNames({});
      setPlan(await previewPsEventTeamImport(eventId, rows));
      setPlanning(false);
    } catch (e: any) {
      setPlanning(false);
      toast.error(`Não foi possível ler a planilha: ${e.message}`);
    }
  };

  const confirm = async () => {
    await importTeam.mutateAsync({ eventId, rows: preview, nameOverrides: confirmedNames });
    setPreview([]);
    setFileName('');
    setPlan(null);
    setConfirmedNames({});
    setExcludedBySelection(0);
    onOpenChange(false);
  };

  const toggleNameConfirmation = (rowIndex: number, collaboratorId: string) => {
    setConfirmedNames((prev) => {
      if (prev[rowIndex] === collaboratorId) {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      }
      return { ...prev, [rowIndex]: collaboratorId };
    });
  };

  const inactiveRowIndexes = new Set(plan?.inactiveMatches.map((inactive) => inactive.rowIndex) || []);
  const unresolvedUnsafeCount = plan
    ? plan.decisions.filter((d) =>
      !inactiveRowIndexes.has(d.rowIndex)
      && (d.status === 'ambiguous' || d.status === 'inconsistent')
      && !confirmedNames[d.rowIndex]).length
    : 0;
  const importableCount = plan ? Math.max(0, preview.length - plan.inactiveCount - plan.manuallyExcludedCount) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setPreview([]); setFileName(''); setPlan(null); setConfirmedNames({}); setExcludedBySelection(0); } }}>
      <DialogContent
        className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="border-b px-4 py-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>Importar colaboradores do evento</DialogTitle>
            <DialogDescription>
              Use a planilha oficial de pagamento (CandidatosPagamento). Colunas aceitas:{' '}
              {PS_TEAM_COLUMNS.join(', ')}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTeamTemplate}>
              <Download className="mr-2 h-4 w-4" />Baixar modelo da planilha
            </Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />Selecionar planilha
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
                />
              </label>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Quando existir a coluna Status de Seleção, somente linhas marcadas como SIM ou Selecionado(a) serão consideradas.
            Reservas, cancelados, dispensados e demais status serão ignorados.{' '}
            A conciliação usa e-mail normalizado, CPF e, como fallback, matrícula + instituição. O nome não provoca
            merge automático. Se os identificadores apontarem para pessoas diferentes, a linha é bloqueada para revisão.
          </p>

          {preview.length > 0 && (
            <Card className="rounded-xl">
              <CardContent className="p-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 border-b p-3 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="min-w-0 break-all font-medium">{fileName}</span>
                  <span className="text-muted-foreground">· {preview.length} colaboradores</span>
                  {excludedBySelection > 0 && <span className="text-amber-600">· {excludedBySelection} não selecionado(s) ignorado(s)</span>}
                </div>
                <details>
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">
                    Ver prévia dos registros
                  </summary>
                  <div className="max-h-56 divide-y overflow-y-auto border-t">
                    {preview.map((r, i) => (
                      <div key={i} className="min-w-0 p-3 text-sm">
                        <p className="break-words font-medium">{r.full_name}</p>
                        <p className="break-words text-xs text-muted-foreground">
                          {[r.role_name, r.sector, r.unit, r.building, r.floor, r.room && `Sala ${r.room}`,
                            r.pay_value ? `R$ ${Number(r.pay_value).toFixed(2)}` : null]
                            .filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          )}

          {plan && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6">
              <Card><CardContent className="p-3"><p className="text-muted-foreground">Encontrados</p><p className="text-xl font-bold">{plan.found}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-muted-foreground">Novos</p><p className="text-xl font-bold">{plan.newCount}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-muted-foreground">Já vinculados</p><p className="text-xl font-bold">{plan.alreadyLinked}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-muted-foreground">Inconsistentes</p><p className="text-xl font-bold">{plan.inconsistent}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-muted-foreground">Ignorados</p><p className="text-xl font-bold">{plan.ignored}</p></CardContent></Card>
              <Card className={plan.inactiveCount ? 'border-amber-500/40 bg-amber-500/5' : ''}><CardContent className="p-3"><p className="text-muted-foreground">Inativos ignorados</p><p className="text-xl font-bold">{plan.inactiveCount}</p></CardContent></Card>
            </div>
          )}

          {plan && plan.manuallyExcludedCount > 0 && (
            <Card className="rounded-xl border-slate-400/40 bg-slate-500/5">
              <CardContent className="space-y-2 p-4">
                <p className="text-sm font-semibold">Mantidos fora deste evento</p>
                <p className="text-xs text-muted-foreground">
                  Estes fiscais já foram excluídos manualmente deste evento e não serão reativados por uma nova importação.
                  Para voltar a incluí-los, use a opção <strong>Reincluir no evento</strong>.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {plan.manuallyExcludedNames.slice(0, 8).map((name) => (
                    <Badge key={name} variant="secondary" className="font-normal">{name}</Badge>
                  ))}
                  {plan.manuallyExcludedCount > 8 && (
                    <Badge variant="outline">+{plan.manuallyExcludedCount - 8}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {plan && plan.inactiveMatches.length > 0 && (
            <Card className="rounded-xl border-amber-500/40 bg-amber-500/5">
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <UserX className="h-4 w-4" />
                  Estes colaboradores estão inativos e não entrarão no evento
                </p>
                <p className="text-xs text-muted-foreground">
                  Os demais registros válidos poderão ser importados normalmente. Para incluir alguém desta lista, ative primeiro o cadastro no Banco de Fiscais.
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-amber-500/20 bg-background/40 p-3 text-sm">
                  {plan.inactiveMatches.map((match) => (
                    <li key={match.rowIndex} className="break-words">
                      <span className="font-medium">Linha {match.rowIndex + 2}: {match.sheetName}</span>
                      {match.sheetName.trim().toLocaleLowerCase('pt-BR') !== match.registeredName.trim().toLocaleLowerCase('pt-BR') && (
                        <span className="text-muted-foreground"> · cadastro: {match.registeredName}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {plan && plan.nameMatches.length > 0 && (
            <Card className="rounded-xl border-amber-500/40 bg-amber-500/5">
              <CardContent className="space-y-3 p-4">
                <p className="text-sm font-medium text-amber-600">
                  Encontramos possíveis ajustes de nomes antes de vincular os avaliadores.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Nome na planilha</th>
                        <th className="pb-2 pr-3 font-medium">Cadastro encontrado</th>
                        <th className="pb-2 pr-3 font-medium">Cargo</th>
                        <th className="pb-2 font-medium">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.nameMatches.map((m) => {
                        const confirmed = confirmedNames[m.rowIndex] === m.matchedCollaboratorId;
                        return (
                          <tr key={m.rowIndex} className="border-t border-border/60">
                            <td className="py-2 pr-3">{m.sheetName}</td>
                            <td className="py-2 pr-3">{m.matchedName}</td>
                            <td className="py-2 pr-3">{m.role === 'coordinator' ? 'Coordenador' : 'Subcoordenador'}</td>
                            <td className="py-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={confirmed ? 'secondary' : 'outline'}
                                onClick={() => toggleNameConfirmation(m.rowIndex, m.matchedCollaboratorId)}
                              >
                                {confirmed ? 'Confirmado ✓' : 'Confirmar alteração'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sem confirmação, a linha segue o comportamento padrão (nenhum vínculo é substituído automaticamente).
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="border-t px-4 py-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={!importableCount || !plan || planning || unresolvedUnsafeCount > 0 || importTeam.isPending}>
            {importTeam.isPending ? 'Importando...' : `Importar ${importableCount || ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
