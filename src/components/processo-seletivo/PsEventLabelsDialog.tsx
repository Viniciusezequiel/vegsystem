import { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, IdCard, Printer, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parsePsExamLabelWorkbook } from '@/lib/psExamLabelSpreadsheet.mjs';
import { generatePsExamLabelsPdf } from '@/lib/psEventPdf';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: { name?: string | null; date?: string | null; location?: string | null };
  team: Array<{ campus?: string | null; building?: string | null }>;
  candidates: Array<{ campus?: string | null; building?: string | null }>;
  onExportTeam: (filters: LocationFilters, format: LabelExportFormat) => void;
  onExportCandidates: (filters: LocationFilters, format: LabelExportFormat) => void;
};

export type LocationFilters = { campus: string; building: string };
export type LabelExportFormat = 'pdf' | 'word';

const cleanLocation = (value?: string | null) => String(value || '').trim();

const filterByLocation = <T extends { campus?: string | null; building?: string | null }>(
  rows: T[],
  filters: LocationFilters,
) => rows.filter((row) =>
  (filters.campus === 'all' || cleanLocation(row.campus) === filters.campus)
  && (filters.building === 'all' || cleanLocation(row.building) === filters.building));

const locationOptions = (rows: Array<{ campus?: string | null; building?: string | null }>, campus: string) => ({
  campuses: [...new Set(rows.map((row) => cleanLocation(row.campus)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  buildings: [...new Set(rows
    .filter((row) => campus === 'all' || cleanLocation(row.campus) === campus)
    .map((row) => cleanLocation(row.building)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
});

export function PsEventLabelsDialog({
  open,
  onOpenChange,
  event,
  team,
  candidates,
  onExportTeam,
  onExportCandidates,
}: Props) {
  const [fileName, setFileName] = useState('');
  const [examRows, setExamRows] = useState<any[]>([]);
  const [sheetCounts, setSheetCounts] = useState<Array<{ name: string; count: number }>>([]);
  const [reading, setReading] = useState(false);
  const [teamFilters, setTeamFilters] = useState<LocationFilters>({ campus: 'all', building: 'all' });
  const [candidateFilters, setCandidateFilters] = useState<LocationFilters>({ campus: 'all', building: 'all' });

  const teamOptions = useMemo(() => locationOptions(team, teamFilters.campus), [team, teamFilters.campus]);
  const candidateOptions = useMemo(() => locationOptions(candidates, candidateFilters.campus), [candidates, candidateFilters.campus]);
  const filteredTeamCount = useMemo(() => filterByLocation(team, teamFilters).length, [team, teamFilters]);
  const filteredCandidateCount = useMemo(() => filterByLocation(candidates, candidateFilters).length, [candidates, candidateFilters]);

  const locationSelectors = (
    options: { campuses: string[]; buildings: string[] },
    filters: LocationFilters,
    setFilters: (filters: LocationFilters) => void,
  ) => (options.campuses.length || options.buildings.length) ? (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.campuses.length > 0 && (
        <Select value={filters.campus} onValueChange={(campus) => setFilters({ campus, building: 'all' })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos os campus" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os campus</SelectItem>{options.campuses.map((campus) => <SelectItem key={campus} value={campus}>{campus}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {options.buildings.length > 0 && (
        <Select value={filters.building} onValueChange={(building) => setFilters({ ...filters, building })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Todos os prédios" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os prédios</SelectItem>{options.buildings.map((building) => <SelectItem key={building} value={building}>{building}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
  ) : null;

  const importSpreadsheet = async (file: File) => {
    setReading(true);
    try {
      const parsed = parsePsExamLabelWorkbook(await file.arrayBuffer());
      setFileName(file.name);
      setExamRows(parsed.rows);
      setSheetCounts(parsed.sheets);
      toast.success(`${parsed.rows.length} etiquetas de provas carregadas.`);
    } catch (error) {
      setFileName('');
      setExamRows([]);
      setSheetCounts([]);
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    } finally {
      setReading(false);
    }
  };

  const exportExamLabels = async (format: LabelExportFormat) => {
    if (!examRows.length) return toast.error('Importe a planilha de etiquetas de provas.');
    const eventInfo = {
      name: event.name || '',
      date: event.date || '',
      location: event.location || '',
    };
    const slug = String(event.name || 'evento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (format === 'word') {
      const { generatePsExamLabelsWord, saveWordBlob } = await import('@/lib/psEventWord');
      saveWordBlob(await generatePsExamLabelsWord(eventInfo, examRows), `etiquetas-provas-${slug || 'evento'}.docx`);
      return;
    }
    generatePsExamLabelsPdf(eventInfo, examRows).save(`etiquetas-provas-${slug || 'evento'}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Central de etiquetas</DialogTitle>
          <p className="text-sm text-muted-foreground">Todos os PDFs usam o modelo Colacril CC182, com 14 etiquetas por página.</p>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="rounded-2xl border-border/60 bg-card/60">
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><Users className="h-4 w-4" /></div>
                <div><p className="font-semibold">Equipe do evento</p><p className="text-xs text-muted-foreground">{filteredTeamCount} de {team.length} colaborador(es)</p></div>
              </div>
              {locationSelectors(teamOptions, teamFilters, setTeamFilters)}
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => onExportTeam(teamFilters, 'pdf')} disabled={!filteredTeamCount}><IdCard className="mr-2 h-4 w-4" />PDF</Button>
                <Button variant="outline" onClick={() => onExportTeam(teamFilters, 'word')} disabled={!filteredTeamCount}><FileText className="mr-2 h-4 w-4" />Word</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-card/60">
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
                <div><p className="font-semibold">Candidatos</p><p className="text-xs text-muted-foreground">{filteredCandidateCount} de {candidates.length} candidato(s)</p></div>
              </div>
              {locationSelectors(candidateOptions, candidateFilters, setCandidateFilters)}
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => onExportCandidates(candidateFilters, 'pdf')} disabled={!filteredCandidateCount}><IdCard className="mr-2 h-4 w-4" />PDF</Button>
                <Button variant="outline" onClick={() => onExportCandidates(candidateFilters, 'word')} disabled={!filteredCandidateCount}><FileText className="mr-2 h-4 w-4" />Word</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card/70 to-card/50">
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/15 p-2.5 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">Materiais de prova</p>
                  <p className="mt-1 text-xs text-muted-foreground">Importe o XLSX com Processo Seletivo, Nome, Prédio, Andar e Sala.</p>
                </div>
              </div>
              <Button asChild variant={examRows.length ? 'outline' : 'default'} disabled={reading}>
                <label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{reading ? 'Lendo...' : examRows.length ? 'Trocar planilha' : 'Importar planilha'}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(inputEvent) => {
                    const file = inputEvent.target.files?.[0];
                    inputEvent.target.value = '';
                    if (file) void importSpreadsheet(file);
                  }} />
                </label>
              </Button>
            </div>

            {examRows.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{examRows.length} etiquetas</Badge>
                  <Badge variant="outline">{Math.ceil(examRows.length / 14)} páginas</Badge>
                  {sheetCounts.map((sheet) => <Badge key={sheet.name} variant="outline">{sheet.name}: {sheet.count}</Badge>)}
                </div>
                <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
                  <div className="border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">{fileName}</div>
                  <div className="divide-y divide-border/40">
                    {examRows.slice(0, 4).map((row, index) => (
                      <div key={`${row.source_sheet}-${row.source_row}-${index}`} className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <span className={row.label_type === 'question_booklet' ? 'font-medium text-red-400' : 'font-medium text-lime-400'}>{row.label_name}</span>
                        <span className="text-muted-foreground">{[row.building, row.floor && `${row.floor} andar`, `Sala ${row.room}`].filter(Boolean).join(' · ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button className="ps-gradient-button" onClick={() => void exportExamLabels('pdf')}><Printer className="mr-2 h-4 w-4" />Gerar PDF ({examRows.length})</Button>
                  <Button variant="outline" onClick={() => void exportExamLabels('word')}><FileText className="mr-2 h-4 w-4" />Gerar Word ({examRows.length})</Button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-7 text-center text-sm text-muted-foreground">
                A planilha é processada no navegador e preserva a quantidade e a ordem das linhas de cada aba.
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
