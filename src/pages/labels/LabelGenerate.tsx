import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useLabelTemplate } from '@/hooks/useLabelTemplates';
import { generateLabelsPdf, getPageDims } from '@/lib/labelPdf';

export default function LabelGenerate() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: tpl, isLoading } = useLabelTemplate(id);

  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // fieldId -> column
  const [cutBorders, setCutBorders] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (json.length === 0) {
        toast({ title: 'Planilha vazia', variant: 'destructive' });
        return;
      }
      const cols = Object.keys(json[0]);
      setRows(json);
      setColumns(cols);
      // auto-map: if field.column matches a column header, keep it
      if (tpl) {
        const m: Record<string, string> = {};
        tpl.fields.forEach((f) => {
          const found = cols.find((c) => c.toLowerCase() === (f.column || '').toLowerCase());
          if (found) m[f.id] = found;
        });
        setMapping(m);
      }
      toast({ title: `${json.length} linha(s) importada(s)` });
    } catch (e: any) {
      toast({ title: 'Erro ao ler planilha', description: e.message, variant: 'destructive' });
    }
  };

  const totalPages = useMemo(() => {
    if (!tpl) return 0;
    const perPage = tpl.columns * tpl.rows;
    return Math.max(1, Math.ceil(rows.length / perPage));
  }, [tpl, rows]);

  const generate = () => {
    if (!tpl || rows.length === 0) return null;
    // Apply mapping: clone fields w/ mapped column
    const mapped = {
      ...tpl,
      fields: tpl.fields.map((f) => ({ ...f, column: mapping[f.id] || f.column })),
    };
    return generateLabelsPdf({ template: mapped, rows, cutBorders });
  };

  const handlePreview = () => {
    const doc = generate();
    if (!doc) return;
    const url = doc.output('bloburl') as unknown as string;
    setPreviewUrl(url.toString());
  };

  const handleDownload = () => {
    const doc = generate();
    if (!doc) return;
    doc.save(`${tpl?.name || 'etiquetas'}.pdf`);
  };

  if (isLoading) return <MainLayout><p className="text-muted-foreground">Carregando...</p></MainLayout>;
  if (!tpl) return <MainLayout><p>Modelo não encontrado.</p></MainLayout>;

  const dims = getPageDims(tpl);

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/labels')}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Gerar etiquetas</h1>
            <p className="text-sm text-muted-foreground">
              {tpl.name} · {tpl.page_size} {tpl.orientation === 'portrait' ? 'retrato' : 'paisagem'} · {dims.w}×{dims.h}mm
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> 1. Importar planilha</h3>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                {rows.length > 0 ? `${rows.length} linha(s) — trocar planilha` : 'Selecionar arquivo .xlsx/.xls'}
              </Button>
              {columns.length > 0 && (
                <p className="text-xs text-muted-foreground">Colunas detectadas: {columns.join(', ')}</p>
              )}
            </Card>

            {columns.length > 0 && (
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold">2. Mapear campos</h3>
                {tpl.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este modelo não possui campos. Edite o modelo primeiro.</p>
                ) : (
                  tpl.fields.map((f) => (
                    <div key={f.id} className="space-y-1.5">
                      <Label>{f.name}</Label>
                      <Select value={mapping[f.id] || ''} onValueChange={(v) => setMapping((m) => ({ ...m, [f.id]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                        <SelectContent>
                          {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))
                )}
              </Card>
            )}

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold">3. Gerar PDF</h3>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Bordas de corte</Label>
                <Switch checked={cutBorders} onCheckedChange={setCutBorders} />
              </div>
              <p className="text-sm text-muted-foreground">
                {rows.length} etiqueta(s) em {totalPages} página(s)
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handlePreview} disabled={rows.length === 0}>
                  <Printer className="h-4 w-4 mr-1" /> Pré-visualizar
                </Button>
                <Button className="flex-1" variant="default" onClick={handleDownload} disabled={rows.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> Baixar PDF
                </Button>
              </div>
            </Card>
          </div>

          <Card className="p-4 min-h-[600px]">
            <h3 className="font-semibold mb-2">Pré-visualização</h3>
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-[800px] border rounded" title="Pré-visualização" />
            ) : (
              <p className="text-sm text-muted-foreground">
                Importe uma planilha, mapeie os campos e clique em "Pré-visualizar" para ver o resultado.
              </p>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
