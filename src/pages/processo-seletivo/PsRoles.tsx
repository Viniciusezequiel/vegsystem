import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePsRoleMutations, usePsRoles } from '@/hooks/useProcessoSeletivo';
import { supabase } from '@/integrations/supabase/client';
import { PS_DEFAULT_ROLES } from '@/lib/psConstants';

type RoleRateKey =
  | 'pay_value_4h'
  | 'pay_value_6h'
  | 'pay_value_7h'
  | 'pay_value_8h'
  | 'pay_value_9h'
  | 'pay_value_integral';

type ImportedRole = {
  name: string;
  value: string;
  active: boolean;
  order: number;
  pay_value: number;
} & Record<RoleRateKey, number | null>;

const ROLE_RATE_FIELDS: Array<{ key: RoleRateKey; label: string }> = [
  { key: 'pay_value_4h', label: '4h' },
  { key: 'pay_value_6h', label: '6h' },
  { key: 'pay_value_7h', label: '7h' },
  { key: 'pay_value_8h', label: '8h' },
  { key: 'pay_value_9h', label: '9h' },
  { key: 'pay_value_integral', label: 'Integral' },
];

const IMPORT_GROUPS: Array<{ functionCol: number; valueCol: number; key: RoleRateKey }> = [
  { functionCol: 0, valueCol: 1, key: 'pay_value_4h' },
  { functionCol: 3, valueCol: 4, key: 'pay_value_6h' },
  { functionCol: 6, valueCol: 7, key: 'pay_value_7h' },
  { functionCol: 9, valueCol: 10, key: 'pay_value_8h' },
  { functionCol: 12, valueCol: 13, key: 'pay_value_9h' },
  { functionCol: 15, valueCol: 16, key: 'pay_value_integral' },
];

const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const normalizeKey = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const titleCaseRole = (value: string) => {
  const smallWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word;
      return word ? `${word.charAt(0).toLocaleUpperCase('pt-BR')}${word.slice(1)}` : word;
    })
    .join(' ');
};

const normalizeImportedRole = (rawValue: unknown) => {
  const raw = String(rawValue ?? '').replace(/\s+/g, ' ').trim();
  const key = normalizeKey(raw);

  if (key === 'EQUIPE DE APOIO' || key === 'APOIO') return { name: 'Equipe de Apoio', value: 'apoio' };
  if (key === 'FISCAL DE SALA') return { name: 'Fiscal de Sala', value: 'fiscal_sala' };
  if (key === 'SUCOORDENADOR A' || key === 'SUBCOORDENADOR A' || key === 'SUBCOORDENADOR') {
    return { name: 'Subcoordenador', value: 'subcoordenador' };
  }
  if (key === 'ADVOGADO A') return { name: 'Advogado(a)', value: 'advogado' };
  if (key === 'COORDENADOR A') return { name: 'Coordenador(a)', value: 'coordenador' };
  if (key === 'ENFERMEIRO A') return { name: 'Enfermeiro(a)', value: 'enfermeiro' };
  if (key === 'MEDICO A') return { name: 'Médico(a)', value: 'medico' };
  if (key === 'OPERADOR DE SCANER' || key === 'OPERADOR DE SCANNER') {
    return { name: 'Operador de Scanner', value: 'operador_de_scaner' };
  }

  const name = titleCaseRole(raw);
  return { name, value: slugify(raw.replace(/\(A\)/gi, '')) };
};

const parseMoney = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value ?? '').trim();
  if (!text || ['NA', 'N A', 'N/A', '-'].includes(normalizeKey(text))) return null;

  const sanitized = text.replace(/[^\d,.-]/g, '');
  const decimal = sanitized.includes(',') ? sanitized.replace(/\./g, '').replace(',', '.') : sanitized;
  const parsed = Number(decimal);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const parseRoleSpreadsheet = async (file: File): Promise<ImportedRole[]> => {
  const workbook = XLSX.read(await file.arrayBuffer());
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });

  const headerIndex = rows.findIndex((row) =>
    normalizeKey(row?.[0]) === 'FUNCAO' && normalizeKey(row?.[1]).includes('VALOR PAGO')
  );

  if (headerIndex < 0) {
    throw new Error('Não encontrei a linha com as colunas Função e Valor pago. Use a tabela de valores praticados.');
  }

  const imported: ImportedRole[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const rawRole = IMPORT_GROUPS.map((group) => row?.[group.functionCol]).find((value) => String(value ?? '').trim());
    if (!rawRole) continue;

    const identity = normalizeImportedRole(rawRole);
    const rates = {} as Record<RoleRateKey, number | null>;

    for (const group of IMPORT_GROUPS) {
      rates[group.key] = parseMoney(row?.[group.valueCol]);
    }

    const defaultValue =
      rates.pay_value_8h ??
      rates.pay_value_9h ??
      rates.pay_value_7h ??
      rates.pay_value_6h ??
      rates.pay_value_4h ??
      rates.pay_value_integral ??
      0;

    imported.push({
      ...identity,
      active: true,
      order: imported.length,
      pay_value: defaultValue,
      ...rates,
    });
  }

  return imported;
};

export default function PsRoles() {
  const queryClient = useQueryClient();
  const { data: roles = [] } = usePsRoles();
  const { save, remove } = usePsRoleMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const openNew = () => {
    setForm({
      name: '', value: '', active: true, order: roles.length, pay_value: 0, combined_roles: [],
      pay_value_4h: null, pay_value_6h: null, pay_value_7h: null,
      pay_value_8h: 0, pay_value_9h: null, pay_value_integral: null,
    });
    setOpen(true);
  };

  const openEdit = (role: any) => {
    setForm({
      ...role,
      pay_value_8h: role.pay_value_8h ?? role.pay_value ?? 0,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) return;
    const payValue = form.pay_value_8h ?? form.pay_value ?? 0;
    await save.mutateAsync({ ...form, pay_value: Number(payValue) || 0, value: form.value || slugify(form.name) });
    setOpen(false);
  };

  const seedDefaults = async () => {
    for (const [index, role] of PS_DEFAULT_ROLES.entries()) {
      if (!roles.some((existing: any) => existing.value === role.value)) {
        await save.mutateAsync({ ...role, active: true, order: index, combined_roles: [] });
      }
    }
  };

  const importSpreadsheet = async (file?: File) => {
    if (!file) return;
    setImporting(true);

    try {
      const imported = await parseRoleSpreadsheet(file);
      if (!imported.length) throw new Error('Nenhum cargo válido foi encontrado na planilha.');

      const confirmed = window.confirm(
        `Foram encontrados ${imported.length} cargos. Deseja importar e atualizar os valores existentes?`
      );
      if (!confirmed) return;

      const { error } = await (supabase as any)
        .from('ps_roles')
        .upsert(imported, { onConflict: 'value' });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['ps_roles'] });
      toast.success(`${imported.length} cargos importados com sucesso.`);
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível importar a planilha.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalValue = (role: any) =>
    Number(role.pay_value || 0) +
    (role.combined_roles || []).reduce(
      (sum: number, value: string) => sum + Number((roles.find((candidate: any) => candidate.value === value) as any)?.pay_value || 0),
      0
    );

  return (
    <MainLayout>
      <PageHeader
        title="Cargos e Valores"
        description="Configure funções, valores por jornada e combinações permitidas para a equipe."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => void importSpreadsheet(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {importing ? 'Importando...' : 'Importar planilha'}
            </Button>
            {roles.length === 0 && <Button variant="outline" size="sm" onClick={() => void seedDefaults()}>Criar cargos padrão</Button>}
            <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo cargo</Button>
          </>
        }
      />

      {roles.length === 0 ? (
        <ContentState
          icon={CircleDollarSign}
          title="Nenhum cargo configurado"
          description="Importe a tabela de valores, crie os cargos padrão ou cadastre uma função manualmente."
          action={<Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Importar planilha</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role: any) => {
            const hasRateTable = ROLE_RATE_FIELDS.some(({ key }) => role[key] != null);

            return (
              <Card key={role.id} className="border-border/60 bg-card/65 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/85 hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">{role.name}</h2>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{role.value}</p>
                    </div>
                    <Badge variant={role.active ? 'default' : 'secondary'}>{role.active ? 'Ativo' : 'Inativo'}</Badge>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/60 bg-muted/15 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor padrão (8h)</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(role.pay_value)}</p>
                  </div>

                  {hasRateTable && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {ROLE_RATE_FIELDS.map(({ key, label }) => (
                        <div key={key} className="rounded-lg border border-border/50 bg-background/40 px-2 py-2">
                          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums">
                            {role[key] == null ? 'N/A' : formatCurrency(role[key])}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(role.combined_roles || []).length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Funções combinadas</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(role.combined_roles || []).map((value: string) => (
                          <Badge key={value} variant="outline" className="text-[10px]">{roles.find((candidate: any) => candidate.value === value)?.name || value}</Badge>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Valor total combinado: <strong className="text-foreground">{formatCurrency(totalValue(role))}</strong></p>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2 border-t border-border/50 pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(role)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />Editar
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { if (confirm('Excluir cargo?')) remove.mutate(role.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar cargo' : 'Novo cargo'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome *</Label>
                <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slug</Label>
                <Input value={form.value} placeholder={slugify(form.name || '')} onChange={event => setForm({ ...form, value: event.target.value })} />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Valores por jornada (R$)</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">O valor de 8h é usado como padrão nos fluxos atuais do processo seletivo.</p>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ROLE_RATE_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground">{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[key] ?? ''}
                        placeholder="N/A"
                        onChange={(event) => setForm({
                          ...form,
                          [key]: event.target.value === '' ? null : Number(event.target.value),
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Ordem</Label>
                <Input type="number" value={form.order} onChange={event => setForm({ ...form, order: Number(event.target.value) })} />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/15 p-3">
                <div>
                  <Label>Disponível para uso</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">Cargos inativos ficam preservados, mas não devem ser usados em novas alocações.</p>
                </div>
                <Switch checked={form.active} onCheckedChange={value => setForm({ ...form, active: value })} />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Funções combinadas</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">Selecione funções cujo valor padrão deve ser somado a este cargo.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.filter((role: any) => role.id !== form.id).map((role: any) => {
                    const active = (form.combined_roles || []).includes(role.value);
                    return (
                      <Button
                        key={role.id}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setForm({
                          ...form,
                          combined_roles: active
                            ? form.combined_roles.filter((value: string) => value !== role.value)
                            : [...(form.combined_roles || []), role.value],
                        })}
                      >
                        {role.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={save.isPending || !form?.name}>{save.isPending ? 'Salvando...' : 'Salvar cargo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
