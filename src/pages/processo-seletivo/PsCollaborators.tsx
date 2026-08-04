import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Trash2, Pencil, Star, Upload } from 'lucide-react';
import { usePsCollaborators, usePsCollaboratorMutations, usePsRoles } from '@/hooks/useProcessoSeletivo';
import * as XLSX from 'xlsx';

const empty = {
  full_name: '', cpf: '', matricula: '', email: '', phone: '', sector: '', position: '',
  preferred_role: '', notes: '', active: true, average_rating: 0, total_events: 0,
};

export default function PsCollaborators() {
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: roles = [] } = usePsRoles();
  const { save, remove, bulkImport } = usePsCollaboratorMutations();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const filtered = collaborators.filter((c: any) =>
    [c.full_name, c.cpf, c.matricula, c.email, c.sector].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const ranking = [...collaborators].sort((a: any, b: any) => Number(b.average_rating) - Number(a.average_rating)).slice(0, 20);

  const submit = async () => {
    if (!form.full_name) return;
    await save.mutateAsync(form);
    setOpen(false);
    setForm(empty);
  };

  const handleImport = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const mapped = rows
      .map((r) => ({
        full_name: String(r['Nome'] ?? r['nome'] ?? r['NOME'] ?? '').trim(),
        cpf: String(r['CPF'] ?? r['cpf'] ?? '').trim() || null,
        matricula: String(r['Matrícula'] ?? r['Matricula'] ?? r['matricula'] ?? '').trim() || null,
        email: String(r['Email'] ?? r['E-mail'] ?? r['email'] ?? '').trim() || null,
        phone: String(r['Telefone'] ?? r['telefone'] ?? '').trim() || null,
        sector: String(r['Setor'] ?? r['setor'] ?? '').trim() || null,
        position: String(r['Cargo'] ?? r['cargo'] ?? '').trim() || null,
        active: true,
      }))
      .filter((r) => r.full_name);
    if (mapped.length) bulkImport.mutate(mapped);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Colaboradores</h1>
            <p className="text-muted-foreground">Banco de fiscais e apoio.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />Importar planilha
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              </label>
            </Button>
            <Button onClick={() => { setForm(empty); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo</Button>
          </div>
        </div>

        <Tabs defaultValue="lista">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-4 pt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome, CPF, matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c: any) => (
                <Card key={c.id} className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{c.full_name}</CardTitle>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Star className="h-3 w-3" />{Number(c.average_rating || 0).toFixed(2)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    {c.sector && <p>Setor: {c.sector}</p>}
                    {c.phone && <p>Tel: {c.phone}</p>}
                    <p>Processos: {c.total_events || 0}</p>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setForm(c); setOpen(true); }}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => { if (confirm('Excluir colaborador?')) remove.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="pt-4">
            <Card className="rounded-2xl">
              <CardContent className="divide-y p-0">
                {ranking.map((c: any, i) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
                      <div>
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.total_events || 0} processos</p>
                      </div>
                    </div>
                    <Badge>{Number(c.average_rating || 0).toFixed(2)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader><DialogTitle>{form?.id ? 'Editar colaborador' : 'Novo colaborador'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={form.cpf || ''} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Matrícula</Label><Input value={form.matricula || ''} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Setor</Label><Input value={form.sector || ''} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></div>
              <div><Label>Cargo interno</Label><Input value={form.position || ''} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            </div>
            <div>
              <Label>Função preferencial</Label>
              <Select value={form.preferred_role || ''} onValueChange={(v) => setForm({ ...form, preferred_role: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r: any) => <SelectItem key={r.id} value={r.value}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
