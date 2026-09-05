import { useState } from 'react';
import { CircleDollarSign, Pencil, Plus, Trash2 } from 'lucide-react';

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
import { PS_DEFAULT_ROLES } from '@/lib/psConstants';

const slugify = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function PsRoles() {
  const { data: roles = [] } = usePsRoles();
  const { save, remove } = usePsRoleMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  const openNew = () => {
    setForm({ name: '', value: '', active: true, order: roles.length, pay_value: 0, combined_roles: [] });
    setOpen(true);
  };

  const openEdit = (role: any) => {
    setForm({ ...role });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name) return;
    await save.mutateAsync({ ...form, value: form.value || slugify(form.name) });
    setOpen(false);
  };

  const seedDefaults = async () => {
    for (const [index, role] of PS_DEFAULT_ROLES.entries()) {
      if (!roles.some((existing: any) => existing.value === role.value)) {
        await save.mutateAsync({ ...role, active: true, order: index, combined_roles: [] });
      }
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
        description="Configure funções, valores por processo e combinações permitidas para a equipe."
        actions={
          <>
            {roles.length === 0 && <Button variant="outline" size="sm" onClick={() => void seedDefaults()}>Criar cargos padrão</Button>}
            <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo cargo</Button>
          </>
        }
      />

      {roles.length === 0 ? (
        <ContentState
          icon={CircleDollarSign}
          title="Nenhum cargo configurado"
          description="Crie os cargos padrão ou cadastre uma função manualmente para começar."
          action={<Button size="sm" onClick={() => void seedDefaults()}>Criar cargos padrão</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role: any) => (
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
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor por processo</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">R$ {Number(role.pay_value || 0).toFixed(2)}</p>
                </div>

                {(role.combined_roles || []).length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Funções combinadas</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(role.combined_roles || []).map((value: string) => (
                        <Badge key={value} variant="outline" className="text-[10px]">{roles.find((candidate: any) => candidate.value === value)?.name || value}</Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Valor total combinado: <strong className="text-foreground">R$ {totalValue(role).toFixed(2)}</strong></p>
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
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={event => event.preventDefault()}>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Valor por processo (R$)</Label>
                  <Input type="number" step="0.01" value={form.pay_value} onChange={event => setForm({ ...form, pay_value: Number(event.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ordem</Label>
                  <Input type="number" value={form.order} onChange={event => setForm({ ...form, order: Number(event.target.value) })} />
                </div>
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
                <p className="mt-1 text-[11px] text-muted-foreground">Selecione funções cujo valor deve ser somado a este cargo.</p>
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
