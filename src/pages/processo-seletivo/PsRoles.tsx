import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, FilterX, Loader2, Pencil, Plus, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { ContentState } from '@/components/layout/ContentState';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [roleSearch, setRoleSearch] = useState('');
  const [roleStatus, setRoleStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [rolePricing, setRolePricing] = useState<'all' | 'special' | 'combined' | 'missing-8h'>('all');

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

  const roleSummary = useMemo(() => {
    const active = roles.filter((role: any) => role.active !== false);
    const withSpecial = roles.filter((role: any) =>
      SPECIAL_ROLE_RATE_FIELDS.some(({ key }) => role[key] != null)
    );
    const combined = roles.filter((role: any) => (role.combined_roles || []).length > 0);
    const missing8h = active.filter((role: any) =>
      role.pay_value_8h == null && Number(role.pay_value || 0) <= 0
    );

    return {
      active: active.length,
      inactive: Math.max(0, roles.length - active.length),
      withSpecial: withSpecial.length,
      combined: combined.length,
      missing8h: missing8h.length,
    };
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const query = roleSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return [...roles]
      .filter((role: any) => {
        if (roleStatus === 'active' && role.active === false) return false;
        if (roleStatus === 'inactive' && role.active !== false) return false;

        const hasSpecial = SPECIAL_ROLE_RATE_FIELDS.some(({ key }) => role[key] != null);
        const hasCombined = (role.combined_roles || []).length > 0;
        const missing8h = role.pay_value_8h == null && Number(role.pay_value || 0) <= 0;

        if (rolePricing === 'special' && !hasSpecial) return false;
        if (rolePricing === 'combined' && !hasCombined) return false;
        if (rolePricing === 'missing-8h' && !missing8h) return false;

        if (!query) return true;

        const haystack = [
          role.name,
          role.value,
          ...(role.combined_roles || []).map((value: string) =>
            roles.find((candidate: any) => candidate.value === value)?.name || value
          ),
        ]
          .filter(Boolean)
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a: any, b: any) =>
        Number(a.order || 0) - Number(b.order || 0) ||
        String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
      );
  }, [roles, roleSearch, roleStatus, rolePricing]);

  const clearRoleFilters = () => {
    setRoleSearch('');
    setRoleStatus('active');
    setRolePricing('all');
  };

  const hasRoleFilters =
    !!roleSearch ||
    roleStatus !== 'active' ||
    rolePricing !== 'all';

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
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border-primary/20 bg-primary/[0.035]">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Cargos ativos</p>
                <p className="mt-1 text-2xl font-bold">{roleSummary.active}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{roleSummary.inactive} inativo(s)</p>
              </CardContent>
            </Card>

            <button type="button" className="text-left" onClick={() => setRolePricing('special')}>
              <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Setor Especial</p>
                  <p className="mt-1 text-2xl font-bold">{roleSummary.withSpecial}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">cargo(s) com tabela diferenciada</p>
                </CardContent>
              </Card>
            </button>

            <button type="button" className="text-left" onClick={() => setRolePricing('combined')}>
              <Card className="h-full rounded-2xl transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Funções combinadas</p>
                  <p className="mt-1 text-2xl font-bold">{roleSummary.combined}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">cargo(s) somam valores de outras funções</p>
                </CardContent>
              </Card>
            </button>

            <button type="button" className="text-left" onClick={() => setRolePricing('missing-8h')}>
              <Card className={`h-full rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md ${roleSummary.missing8h
                ? 'border-amber-500/25 bg-amber-500/[0.035]'
                : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Sem valor padrão 8h</p>
                  <p className={`mt-1 text-2xl font-bold ${roleSummary.missing8h ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {roleSummary.missing8h}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {roleSummary.missing8h ? 'precisam de conferência' : 'todos os ativos possuem valor'}
                  </p>
                </CardContent>
              </Card>
            </button>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold">Tabela de cargos e valores</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Compare as jornadas sem precisar abrir cada cargo individualmente.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit rounded-full">
                  {filteredRoles.length} cargo(s)
                </Badge>
              </div>

              <div className="grid gap-2 lg:grid-cols-[minmax(280px,1fr)_190px_220px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={roleSearch}
                    onChange={(event) => setRoleSearch(event.target.value)}
                    placeholder="Buscar cargo, slug ou função combinada..."
                    className="h-10 rounded-xl pl-10"
                  />
                </div>

                <Select value={roleStatus} onValueChange={(value: any) => setRoleStatus(value)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                    <SelectItem value="all">Ativos e inativos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={rolePricing} onValueChange={(value: any) => setRolePricing(value)}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Tipo de valor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="special">Com Setor Especial</SelectItem>
                    <SelectItem value="combined">Funções combinadas</SelectItem>
                    <SelectItem value="missing-8h">Sem valor padrão 8h</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 rounded-xl"
                  disabled={!hasRoleFilters}
                  onClick={clearRoleFilters}
                >
                  <FilterX className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/65 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-left">
                  <thead className="border-b border-border/60 bg-muted/20">
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="sticky left-0 z-10 min-w-[260px] bg-muted/95 px-4 py-3 font-semibold">Cargo</th>
                      {ROLE_RATE_FIELDS.map(({ key, label }) => (
                        <th key={key} className="min-w-[105px] px-3 py-3 text-right font-semibold">{label}</th>
                      ))}
                      <th className="min-w-[150px] px-3 py-3 text-center font-semibold">Setor Especial</th>
                      <th className="min-w-[120px] px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border/50">
                    {filteredRoles.map((role: any) => {
                      const hasSpecialRateTable = SPECIAL_ROLE_RATE_FIELDS.some(({ key }) => role[key] != null);
                      const combinedRoles = role.combined_roles || [];
                      const eightHourValue = role.pay_value_8h ?? role.pay_value;

                      return (
                        <tr key={role.id} className={`transition-colors hover:bg-muted/15 ${role.active === false ? 'opacity-55' : ''}`}>
                          <td className="sticky left-0 z-[1] bg-card px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">{role.name}</p>
                                <Badge variant={role.active ? 'default' : 'secondary'} className="text-[9px]">
                                  {role.active ? 'Ativo' : 'Inativo'}
                                </Badge>
                                {combinedRoles.length > 0 && (
                                  <Badge variant="outline" className="text-[9px]">
                                    {combinedRoles.length} combinada(s)
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 font-mono text-[9px] text-muted-foreground">{role.value}</p>
                              {combinedRoles.length > 0 && (
                                <p className="mt-1.5 max-w-[340px] truncate text-[10px] text-muted-foreground" title={combinedRoles.map((value: string) => roles.find((candidate: any) => candidate.value === value)?.name || value).join(', ')}>
                                  Soma: {combinedRoles.map((value: string) => roles.find((candidate: any) => candidate.value === value)?.name || value).join(' + ')}
                                </p>
                              )}
                            </div>
                          </td>

                          {ROLE_RATE_FIELDS.map(({ key }) => {
                            const value = key === 'pay_value_8h' ? eightHourValue : role[key];
                            return (
                              <td key={key} className="px-3 py-3 text-right text-xs tabular-nums">
                                {value == null
                                  ? <span className="text-muted-foreground/55">—</span>
                                  : <span className={key === 'pay_value_8h' ? 'font-semibold text-foreground' : 'text-foreground/85'}>
                                      {formatCurrency(value)}
                                    </span>}
                              </td>
                            );
                          })}

                          <td className="px-3 py-3 text-center">
                            {hasSpecialRateTable ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-lg text-[10px] text-primary"
                                onClick={() => openEdit(role)}
                              >
                                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                Ver valores
                              </Button>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Padrão</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg px-2.5 text-[10px]"
                                onClick={() => openEdit(role)}
                              >
                                <Pencil className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Excluir o cargo "${role.name}"?`)) remove.mutate(role.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!filteredRoles.length && (
                <div className="p-10 text-center">
                  <CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-semibold">Nenhum cargo encontrado</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros para visualizar os cargos.</p>
                </div>
              )}
            </CardContent>
          </Card>
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
