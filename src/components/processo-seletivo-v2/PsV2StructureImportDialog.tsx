import { useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizePsV2StructureRows } from '@/lib/psV2Import';
import { importPsV2Structure } from '@/lib/psV2StructureService';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; schemaReady: boolean };

export function PsV2StructureImportDialog({ open, onOpenChange, schemaReady }: Props) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ReturnType<typeof normalizePsV2StructureRows> | null>(null);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const reset = () => { setPreview(null); setFileName(''); };
  const close = () => { reset(); onOpenChange(false); };
  const readFile = async (file?: File) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      setFileName(file.name); setPreview(normalizePsV2StructureRows(raw));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    }
  };
  const runImport = async () => {
    if (!preview?.rows.length || preview.hasErrors || !schemaReady) return;
    setIsImporting(true);
    try {
      const result = await importPsV2Structure(preview.rows, 'import');
      await qc.invalidateQueries({ queryKey: ['ps-v2'] });
      toast.success(`Importação concluída: ${result.environments} ambientes novos.`);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar estrutura.');
    } finally { setIsImporting(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>Importar estrutura por planilha</DialogTitle><DialogDescription>O arquivo é validado antes de qualquer gravação. Colunas reconhecidas: local/campus, endereço, prédio/bloco, andar, área/corredor, ambiente/sala, tipos e capacidade.</DialogDescription></DialogHeader>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 p-7 text-center transition hover:border-primary/35 hover:bg-primary/[0.03]">
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={event => readFile(event.target.files?.[0])} />
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
        <p className="mt-3 text-sm font-medium">Selecionar Excel ou CSV</p><p className="mt-1 text-xs text-muted-foreground">{fileName || 'Nenhum arquivo selecionado'}</p>
      </label>

      {!schemaReady && <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-sm">A migration da estrutura V2 precisa ser aplicada antes de gravar. A pré-visualização continua disponível.</div>}
      {preview && <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[['Linhas', preview.stats.validRows], ['Locais', preview.stats.locations], ['Prédios', preview.stats.buildings], ['Andares', preview.stats.floors], ['Áreas', preview.stats.areas], ['Ambientes', preview.stats.environments]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border/60 bg-card/60 p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
        </div>
        {!!preview.issues.length && <div className="rounded-xl border border-border/60 p-3"><p className="mb-2 text-sm font-medium">Validações</p><div className="max-h-32 space-y-1 overflow-y-auto">{preview.issues.slice(0, 30).map((issue, index) => <div key={`${issue.row}-${index}`} className="flex items-start gap-2 text-xs"><Badge variant={issue.level === 'error' ? 'destructive' : 'secondary'} className="mt-0.5">Linha {issue.row}</Badge><span className="pt-1 text-muted-foreground">{issue.message}</span></div>)}</div></div>}
        <div className="overflow-hidden rounded-xl border border-border/60"><div className="border-b bg-muted/20 px-3 py-2 text-xs font-medium">Prévia das primeiras linhas válidas</div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted/10 text-muted-foreground"><tr><th className="p-2">Local</th><th className="p-2">Prédio</th><th className="p-2">Andar</th><th className="p-2">Área</th><th className="p-2">Ambiente</th><th className="p-2">Cap.</th></tr></thead><tbody>{preview.rows.slice(0, 12).map((row, index) => <tr key={index} className="border-t border-border/40"><td className="p-2">{row.location}</td><td className="p-2">{row.building}</td><td className="p-2">{row.floor}</td><td className="p-2">{row.area || '—'}</td><td className="p-2">{row.environment || '—'}</td><td className="p-2">{row.capacity ?? '—'}</td></tr>)}</tbody></table></div></div>
      </div>}
      <DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button onClick={runImport} disabled={!schemaReady || !preview?.rows.length || preview.hasErrors || isImporting}>{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}Importar estrutura</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
