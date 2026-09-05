import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  const [mapping, setMapping] = useState<Record<string, string>>({});
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

  if (isLoading) {
    return (
      <MainLayout>
        <ContentState loading title="Carregando modelo" description="Preparando a geração das etiquetas." />
      </MainLayout>
    );
  }

  if (!tpl) {
    return (
      <MainLayout>
        <ContentState
          title="Modelo não encontrado"
          description="O modelo solicitado não está disponível."
          action={<Button variant="outline" onClick={() => navigate('/labels')}>Voltar aos modelos</Button>}
        />
      </MainLayout>
    );
  }

  const dims = getPageDims(tpl);

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeader
          title="Gerar etiquetas"
          description={`${tpl.name} · ${tpl.page_size} ${tpl.orientation === 'portrait' ? 'retrato' : 'paisagem'} · ${dims.w}×${dims.h}mm`}
          actions={
            <Button variant="outline" onClick={() => navigate('/labels')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <Card className="space-y-3 border-border/60 bg-card/65 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs text-primary">1</span>
                  Importar planilha
                </h3>
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              </div>
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
                <p className="text-xs leading-relaxed text-muted-foreground">Colunas detectadas: {columns.join(', ')}</p>
              )}
            </Card>

            {columns.length > 0 && (
              <Card className="space-y-3 border-border/60 bg-card/65 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs text-primary">2</span>
                  Mapear campos
                </h3>
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

            <Card className="space-y-3 border-border/60 bg-card/65 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs text-primary">3</span>
                Gerar PDF
              </h3>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <Label className="text-sm">Bordas de corte</Label>
                <Switch checked={cutBorders} onCheckedChange={setCutBorders} />
              </div>
              <p className="text-sm text-muted-foreground">
                {rows.length} etiqueta(s) em {totalPages} página(s)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handlePreview} disabled={rows.length === 0}>
                  <Printer className="mr-1 h-4 w-4" />
                  Pré-visualizar
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={rows.length === 0}>
                  <Download className="mr-1 h-4 w-4" />
                  Baixar PDF
                </Button>
              </div>
            </Card>
          </div>

          <Card className="min-h-[600px] border-border/60 bg-card/65 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Pré-visualização</h3>
              {previewUrl && <span className="text-xs text-muted-foreground">PDF atualizado</span>}
            </div>
            {previewUrl ? (
              <iframe src={previewUrl} className="h-[800px] w-full rounded-lg border border-border/60 bg-background" title="Pré-visualização" />
            ) : (
              <ContentState
                icon={Printer}
                title="Pré-visualização ainda não gerada"
                description="Importe uma planilha, mapeie os campos e clique em Pré-visualizar."
                className="min-h-[520px]"
              />
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
