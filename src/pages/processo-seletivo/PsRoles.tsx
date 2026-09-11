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
import { parsePsRoleSpreadsheetRows } from '@/lib/psRoleSpreadsheet.mjs';

type RoleRateKey =
  | 'pay_value_4h'
  | 'pay_value_6h'
  | 'pay_value_7h'
  | 'pay_value_8h'
  | 'pay_value_9h'
  | 'pay_value_integral';

type SpecialRoleRateKey =
  | 'pay_value_special_4h'
  | 'pay_value_special_6h'
  | 'pay_value_special_7h'
  | 'pay_value_special_8h'
  | 'pay_value_special_9h'
  | 'pay_value_special_integral';

type ImportedRole = {
  name: string;
  value: string;
  active: boolean;
  order: number;
  pay_value: number;
  combined_roles: string[];
} & Record<RoleRateKey | SpecialRoleRateKey, number | null>;

type RateField = { key: RoleRateKey | SpecialRoleRateKey; label: string };

const ROLE_RATE_FIELDS: RateField[] = [
  { key: 'pay_value_4h', label: '4h' },
  { key: 'pay_value_6h', label: '6h' },
  { key: 'pay_value_7h', label: '7h' },
  { key: 'pay_value_8h', label: '8h' },
  { key: 'pay_value_9h', label: '9h' },
  { key: 'pay_value_integral', label: 'Integral' },
];

const SPECIAL_ROLE_RATE_FIELDS: RateField[] = [
  { key: 'pay_value_special_4h', label: '4h' },
  { key: 'pay_value_special_6h', label: '6h' },
  { key: 'pay_value_special_7h', label: '7h' },
  { key: 'pay_value_special_8h', label: '8h' },
  { key: 'pay_value_special_9h', label: '9h' },
  { key: 'pay_value_special_integral', label: 'Integral' },
];

const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const parseRoleSpreadsheet = async (file: File): Promise<ImportedRole[]> => {
  const workbook = XLSX.read(await file.arrayBuffer());
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error('A planilha não possui uma aba válida.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
  return parsePsRoleSpreadsheetRows(rows) as ImportedRole[];
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
      pay_value_special_4h: null, pay_value_special_6h: null, pay_value_special_7h: null,
      pay_value_special_8h: null, pay_value_special_9h: null, pay_value_special_integral: null,
    });
    setOpen(true);
  };

  const openEdit = (role: any) => {
    setForm({
      ...role,
      combined_roles: role.combined_roles || [],
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
        `Foram encontrados ${imported.length} cargos. Esta importação substituirá TODOS os cargos atuais e seus valores pela planilha selecionada. Deseja continuar?`
      );
      if (!confirmed) return;

      const { error: upsertError } = await (supabase as any)
        .from('ps_roles')
        .upsert(imported, { onConflict: 'value' });
      if (upsertError) throw upsertError;

      const importedValues = new Set(imported.map(role => role.value));
      const { data: currentRoles, error: currentRolesError } = await (supabase as any)
        .from('ps_roles')
        .select('id,value');
      if (currentRolesError) throw currentRolesError;

      const staleIds = (currentRoles || [])
        .filter((role: any) => !importedValues.has(role.value))
        .map((role: any) => role.id);

      if (staleIds.length) {
        const { error: deleteError } = await (supabase as any)
          .from('ps_roles')
          .delete()
          .in('id', staleIds);
        if (deleteError) throw deleteError;
      }

      await queryClient.invalidateQueries({ queryKey: ['ps_roles'] });
      toast.success(`${imported.length} cargos substituídos com sucesso.`);
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
        description="Configure funções, valores por jornada e valores específicos do Setor Especial."
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
            const hasSpecialRateTable = SPECIAL_ROLE_RATE_FIELDS.some(({ key }) => role[key] != null);

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
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tabela padrão</p>
                      <div className="grid grid-cols-3 gap-2">
                        {ROLE_RATE_FIELDS.map(({ key, label }) => (
                          <div key={key} className="rounded-lg border border-border/50 bg-background/40 px-2 py-2">
                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="mt-0.5 text-xs font-semibold tabular-nums">
                              {role[key] == null ? 'N/A' : formatCurrency(role[key])}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasSpecialRateTable && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Setor Especial</p>
                        <Badge variant="outline" className="text-[9px]">Valores específicos</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {SPECIAL_ROLE_RATE_FIELDS.map(({ key, label }) => (
                          <div key={key} className="rounded-lg border border-border/50 bg-background/50 px-2 py-2">
                            <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                            <p className="mt-0.5 text-xs font-semibold tabular-nums">
                              {role[key] == null ? 'N/A' : formatCurrency(role[key])}
                            </p>
                          </div>
                        ))}
                      </div>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onInteractOutside={event => event.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar cargo' : 'Novo cargo'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome *</Label>
                <Input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Slug</Label>
                <Input value={form.value} placeholder={slugify(form.name || '')} onChange={event => setForm({ ...form, value: event.target.value })} />
              </div>

              <div className="rounded-xl border border-border/60 p-4">
                <Label className="text-xs text-muted-foreground">Valores por jornada (R$)</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">O valor de 8h é usado como padrão nos fluxos atuais do processo seletivo.</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Label className="text-xs font-semibold text-primary">Valores do Setor Especial (R$)</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">Preencha somente as jornadas que possuem valor diferenciado na tabela oficial.</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {SPECIAL_ROLE_RATE_FIELDS.map(({ key, label }) => (
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
