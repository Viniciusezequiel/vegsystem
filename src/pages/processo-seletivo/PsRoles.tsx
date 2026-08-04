import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { usePsRoles, usePsRoleMutations } from '@/hooks/useProcessoSeletivo';
import { PS_DEFAULT_ROLES } from '@/lib/psConstants';

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export default function PsRoles() {
  const { data: roles = [] } = usePsRoles();
  const { save, remove } = usePsRoleMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  const openNew = () => { setForm({ name: '', value: '', active: true, order: roles.length, pay_value: 0, combined_roles: [] }); setOpen(true); };
  const openEdit = (r: any) => { setForm({ ...r }); setOpen(true); };

  const submit = async () => {
    if (!form.name) return;
    await save.mutateAsync({ ...form, value: form.value || slugify(form.name) });
    setOpen(false);
  };

  const seedDefaults = async () => {
    for (const [i, r] of PS_DEFAULT_ROLES.entries()) {
      if (!roles.some((x: any) => x.value === r.value)) {
        await save.mutateAsync({ ...r, active: true, order: i, combined_roles: [] });
      }
    }
  };

  const totalValue = (r: any) =>
    Number(r.pay_value || 0) +
    (r.combined_roles || []).reduce((acc: number, s: string) => acc + Number((roles.find((x: any) => x.value === s) as any)?.pay_value || 0), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Cargos e Valores</h1>
            <p className="text-muted-foreground">Cargos do processo seletivo, valores por processo e funções combinadas.</p>
          </div>
          <div className="flex gap-2">
            {roles.length === 0 && <Button variant="outline" onClick={seedDefaults}>Criar cargos padrão</Button>}
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo cargo</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((r: any) => (
            <Card key={r.id} className="rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.value}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Valor: <strong>R$ {Number(r.pay_value).toFixed(2)}</strong></p>
                {(r.combined_roles || []).length > 0 && (
                  <p className="text-muted-foreground">Combinado: {r.combined_roles.join(', ')} — total R$ {totalValue(r).toFixed(2)}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(r)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => { if (confirm('Excluir cargo?')) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar cargo' : 'Novo cargo'}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={form.value} placeholder={slugify(form.name || '')} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div><Label>Valor por processo (R$)</Label><Input type="number" step="0.01" value={form.pay_value} onChange={(e) => setForm({ ...form, pay_value: Number(e.target.value) })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Ativo</Label>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <div>
                <Label>Funções combinadas (soma os valores)</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.filter((r: any) => r.id !== form.id).map((r: any) => {
                    const active = (form.combined_roles || []).includes(r.value);
                    return (
                      <Button
                        key={r.id}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() =>
                          setForm({
                            ...form,
                            combined_roles: active
                              ? form.combined_roles.filter((v: string) => v !== r.value)
                              : [...(form.combined_roles || []), r.value],
                          })
                        }
                      >
                        {r.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
