import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import {
  useLabelTemplate, useSaveLabelTemplate, type LabelTemplate, type LabelField,
} from '@/hooks/useLabelTemplates';
import { getPageDims } from '@/lib/labelPdf';

const newField = (): LabelField => ({
  id: crypto.randomUUID(),
  name: 'Novo campo',
  column: '',
  x: 2,
  y: 2,
  width: 40,
  fontSize: 10,
  fontFamily: 'helvetica',
  bold: false,
  italic: false,
  align: 'left',
  wrap: true,
  lineHeight: 1.2,
  color: '#000000',
});

const blankTemplate = (): Partial<LabelTemplate> => ({
  name: 'Novo modelo',
  page_size: 'A4',
  orientation: 'portrait',
  page_margin_top: 10, page_margin_bottom: 10, page_margin_left: 10, page_margin_right: 10,
  label_width: 60, label_height: 30, columns: 3, rows: 9,
  horizontal_gap: 2, vertical_gap: 0,
  fields: [],
});

export default function LabelTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: existing, isLoading } = useLabelTemplate(id);
  const save = useSaveLabelTemplate();

  const [tpl, setTpl] = useState<Partial<LabelTemplate>>(blankTemplate());
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (existing) setTpl(existing);
  }, [existing]);

  const update = (patch: Partial<LabelTemplate>) => setTpl((p) => ({ ...p, ...patch }));
  const updateField = (fid: string, patch: Partial<LabelField>) => {
    setTpl((p) => ({ ...p, fields: (p.fields || []).map((f) => (f.id === fid ? { ...f, ...patch } : f)) }));
  };
  const addField = () => {
    const f = newField();
    setTpl((p) => ({ ...p, fields: [...(p.fields || []), f] }));
    setSelectedFieldId(f.id);
  };
  const removeField = (fid: string) => {
    setTpl((p) => ({ ...p, fields: (p.fields || []).filter((f) => f.id !== fid) }));
    if (selectedFieldId === fid) setSelectedFieldId(null);
  };

  const selectedField = (tpl.fields || []).find((f) => f.id === selectedFieldId) || null;

  const handleSave = async () => {
    if (!tpl.name?.trim()) {
      toast({ title: 'Informe o nome', variant: 'destructive' });
      return;
    }
    try {
      const saved: any = await save.mutateAsync(tpl as any);
      toast({ title: 'Modelo salvo' });
      if (!id && saved?.id) navigate(`/labels/edit/${saved.id}`, { replace: true });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <MainLayout><p className="text-muted-foreground">Carregando...</p></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/labels')}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="text-2xl font-bold">{id ? 'Editar modelo' : 'Novo modelo'}</h1>
          </div>
          <Button onClick={handleSave} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" /> Salvar
          </Button>
        </div>

        <Tabs defaultValue="page">
          <TabsList>
            <TabsTrigger value="page">1. Página e Etiqueta</TabsTrigger>
            <TabsTrigger value="fields">2. Campos</TabsTrigger>
          </TabsList>

          <TabsContent value="page" className="space-y-4">
            <Card className="p-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                <Label>Nome do modelo</Label>
                <Input value={tpl.name || ''} onChange={(e) => update({ name: e.target.value })} placeholder="Ex: Colacril CC182" />
              </div>
              <div className="space-y-1.5">
                <Label>Tamanho da página</Label>
                <Select value={tpl.page_size} onValueChange={(v: any) => update({ page_size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210×297mm)</SelectItem>
                    <SelectItem value="Letter">Carta (215.9×279.4mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Orientação</Label>
                <Select value={tpl.orientation} onValueChange={(v: any) => update({ orientation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Retrato</SelectItem>
                    <SelectItem value="landscape">Paisagem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumField label="Largura da etiqueta (mm)" value={tpl.label_width!} onChange={(v) => update({ label_width: v })} />
              <NumField label="Altura da etiqueta (mm)" value={tpl.label_height!} onChange={(v) => update({ label_height: v })} />
              <NumField label="Colunas por página" value={tpl.columns!} onChange={(v) => update({ columns: Math.max(1, Math.round(v)) })} step={1} />
              <NumField label="Linhas por página" value={tpl.rows!} onChange={(v) => update({ rows: Math.max(1, Math.round(v)) })} step={1} />
              <NumField label="Margem superior (mm)" value={tpl.page_margin_top!} onChange={(v) => update({ page_margin_top: v })} />
              <NumField label="Margem inferior (mm)" value={tpl.page_margin_bottom!} onChange={(v) => update({ page_margin_bottom: v })} />
              <NumField label="Margem esquerda (mm)" value={tpl.page_margin_left!} onChange={(v) => update({ page_margin_left: v })} />
              <NumField label="Margem direita (mm)" value={tpl.page_margin_right!} onChange={(v) => update({ page_margin_right: v })} />
              <NumField label="Espaçamento horizontal (mm)" value={tpl.horizontal_gap!} onChange={(v) => update({ horizontal_gap: v })} />
              <NumField label="Espaçamento vertical (mm)" value={tpl.vertical_gap!} onChange={(v) => update({ vertical_gap: v })} />
            </Card>

            <PageOverview tpl={tpl as LabelTemplate} />
          </TabsContent>

          <TabsContent value="fields" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Editor visual da etiqueta</h3>
                  <Button size="sm" onClick={addField}><Plus className="h-4 w-4 mr-1" /> Adicionar campo</Button>
                </div>
                <p className="text-xs text-muted-foreground">Arraste os campos dentro da área da etiqueta para posicioná-los.</p>
                <LabelCanvas
                  tpl={tpl as LabelTemplate}
                  selectedId={selectedFieldId}
                  onSelect={setSelectedFieldId}
                  onMove={(fid, x, y) => updateField(fid, { x, y })}
                />
              </Card>

              <Card className="p-4 space-y-3">
                {selectedField ? (
                  <FieldEditor field={selectedField} onChange={(p) => updateField(selectedField.id, p)} onRemove={() => removeField(selectedField.id)} />
                ) : (
                  <p className="text-sm text-muted-foreground">Selecione um campo no editor para configurá-lo, ou adicione um novo campo.</p>
                )}

                {(tpl.fields || []).length > 0 && (
                  <div className="pt-3 border-t space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Lista de campos</p>
                    {(tpl.fields || []).map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedFieldId(f.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent ${selectedFieldId === f.id ? 'bg-accent' : ''}`}
                      >
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> · coluna: {f.column || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function NumField({ label, value, onChange, step = 0.5 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function PageOverview({ tpl }: { tpl: LabelTemplate }) {
  const { w: pageW, h: pageH } = getPageDims(tpl);
  const scale = 1.6; // px per mm
  return (
    <Card className="p-4">
      <p className="text-sm font-medium mb-2">Pré-visualização da página</p>
      <div className="overflow-auto">
        <div
          className="relative bg-white border border-border shadow-sm"
          style={{ width: pageW * scale, height: pageH * scale }}
        >
          {Array.from({ length: tpl.rows || 0 }).map((_, r) =>
            Array.from({ length: tpl.columns || 0 }).map((_, c) => {
              const x = (tpl.page_margin_left + c * (tpl.label_width + tpl.horizontal_gap)) * scale;
              const y = (tpl.page_margin_top + r * (tpl.label_height + tpl.vertical_gap)) * scale;
              return (
                <div
                  key={`${r}-${c}`}
                  className="absolute border border-dashed border-primary/40 bg-primary/5"
                  style={{ left: x, top: y, width: tpl.label_width * scale, height: tpl.label_height * scale }}
                />
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}

function LabelCanvas({
  tpl, selectedId, onSelect, onMove,
}: {
  tpl: LabelTemplate;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const scale = 4; // px per mm — large for editing
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent, f: LabelField) => {
    e.stopPropagation();
    onSelect(f.id);
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    drag.current = {
      id: f.id,
      offX: e.clientX - f.x * scale,
      offY: e.clientY - f.y * scale,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let xMm = (e.clientX - drag.current.offX) / scale;
    let yMm = (e.clientY - drag.current.offY) / scale;
    xMm = Math.max(0, Math.min(tpl.label_width - 1, xMm));
    yMm = Math.max(0, Math.min(tpl.label_height - 1, yMm));
    onMove(drag.current.id, Math.round(xMm * 10) / 10, Math.round(yMm * 10) / 10);
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div className="overflow-auto">
      <div
        ref={ref}
        className="relative bg-white border-2 border-border shadow-inner mx-auto"
        style={{ width: tpl.label_width * scale, height: tpl.label_height * scale }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {(tpl.fields || []).map((f) => (
          <div
            key={f.id}
            onPointerDown={(e) => onPointerDown(e, f)}
            className={`absolute cursor-move select-none px-1 py-0.5 border ${selectedId === f.id ? 'border-primary bg-primary/10' : 'border-muted-foreground/40 bg-muted/30'} hover:border-primary`}
            style={{
              left: f.x * scale,
              top: f.y * scale,
              width: (f.width || 40) * scale,
              fontSize: Math.max(8, f.fontSize * 0.9),
              fontFamily: f.fontFamily,
              fontWeight: f.bold ? 700 : 400,
              fontStyle: f.italic ? 'italic' : 'normal',
              textAlign: f.align,
              color: f.color,
              lineHeight: f.lineHeight,
              whiteSpace: f.wrap ? 'normal' : 'nowrap',
              overflow: 'hidden',
            }}
            title={f.name}
          >
            {`{${f.column || f.name}}`}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldEditor({ field, onChange, onRemove }: { field: LabelField; onChange: (p: Partial<LabelField>) => void; onRemove: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Campo</h3>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label>Nome do campo</Label>
        <Input value={field.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Coluna da planilha</Label>
        <Input value={field.column} onChange={(e) => onChange({ column: e.target.value })} placeholder="Ex: Nome" />
        <p className="text-xs text-muted-foreground">Será mapeado também na hora de gerar.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="X (mm)" value={field.x} onChange={(v) => onChange({ x: v })} />
        <NumField label="Y (mm)" value={field.y} onChange={(v) => onChange({ y: v })} />
        <NumField label="Largura (mm)" value={field.width} onChange={(v) => onChange({ width: v })} />
        <NumField label="Tamanho fonte (pt)" value={field.fontSize} onChange={(v) => onChange({ fontSize: v })} step={1} />
      </div>
      <div className="space-y-1.5">
        <Label>Fonte</Label>
        <Select value={field.fontFamily} onValueChange={(v: any) => onChange({ fontFamily: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="helvetica">Helvetica</SelectItem>
            <SelectItem value="times">Times</SelectItem>
            <SelectItem value="courier">Courier</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Alinhamento</Label>
        <Select value={field.align} onValueChange={(v: any) => onChange({ align: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Esquerda</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="right">Direita</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Espaç. linhas" value={field.lineHeight} onChange={(v) => onChange({ lineHeight: v })} step={0.1} />
        <div className="space-y-1.5">
          <Label>Cor</Label>
          <Input type="color" value={field.color} onChange={(e) => onChange({ color: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label>Negrito</Label>
        <Switch checked={field.bold} onCheckedChange={(v) => onChange({ bold: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Itálico</Label>
        <Switch checked={field.italic} onCheckedChange={(v) => onChange({ italic: v })} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Quebra de linha automática</Label>
        <Switch checked={field.wrap} onCheckedChange={(v) => onChange({ wrap: v })} />
      </div>
    </div>
  );
}
