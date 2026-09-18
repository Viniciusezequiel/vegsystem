import { useState } from 'react';
import { FileSpreadsheet, FileText, IdCard, Printer, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parsePsExamLabelWorkbook } from '@/lib/psExamLabelSpreadsheet.mjs';
import { generatePsExamLabelsPdf } from '@/lib/psEventPdf';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: { name?: string | null; date?: string | null; location?: string | null };
  teamCount: number;
  candidateCount: number;
  onExportTeam: () => void;
  onExportCandidates: () => void;
};

export function PsEventLabelsDialog({
  open,
  onOpenChange,
  event,
  teamCount,
  candidateCount,
  onExportTeam,
  onExportCandidates,
}: Props) {
  const [fileName, setFileName] = useState('');
  const [examRows, setExamRows] = useState<any[]>([]);
  const [sheetCounts, setSheetCounts] = useState<Array<{ name: string; count: number }>>([]);
  const [reading, setReading] = useState(false);

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

  const exportExamLabels = () => {
    if (!examRows.length) return toast.error('Importe a planilha de etiquetas de provas.');
    const eventInfo = {
      name: event.name || '',
      date: event.date || '',
      location: event.location || '',
    };
    const slug = String(event.name || 'evento').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
                <div><p className="font-semibold">Equipe do evento</p><p className="text-xs text-muted-foreground">{teamCount} colaborador(es)</p></div>
              </div>
              <Button variant="outline" className="mt-auto" onClick={onExportTeam} disabled={!teamCount}><IdCard className="mr-2 h-4 w-4" />Gerar etiquetas da equipe</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/60 bg-card/60">
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></div>
                <div><p className="font-semibold">Candidatos</p><p className="text-xs text-muted-foreground">{candidateCount} candidato(s)</p></div>
              </div>
              <Button variant="outline" className="mt-auto" onClick={onExportCandidates} disabled={!candidateCount}><IdCard className="mr-2 h-4 w-4" />Gerar etiquetas dos candidatos</Button>
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
                <Button className="w-full ps-gradient-button" onClick={exportExamLabels}><Printer className="mr-2 h-4 w-4" />Gerar PDF com {examRows.length} etiquetas</Button>
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

