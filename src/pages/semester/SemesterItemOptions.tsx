import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  useItemOptions,
  useCreateItemOption,
  useDeleteItemOption,
} from '@/hooks/useSemesterChecklist';
import { SEMESTER_CATEGORIES, SEMESTER_BASE_ITEMS } from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, ShieldAlert, Lock } from 'lucide-react';

export default function SemesterItemOptions() {
  const { isAdmin } = useAuth();
  const { data: options = [], isLoading } = useItemOptions();
  const create = useCreateItemOption();
  const del = useDeleteItemOption();

  const [category, setCategory] = useState<string>(SEMESTER_CATEGORIES[0]);
  const [label, setLabel] = useState('');

  const byCategory = useMemo(() => {
    const map: Record<string, { label: string; id?: string; fixed?: boolean }[]> = {};
    SEMESTER_CATEGORIES.forEach((c) => {
      map[c] = (SEMESTER_BASE_ITEMS[c] ?? []).map((l) => ({ label: l, fixed: true }));
    });
    options.forEach((o) => {
      if (!map[o.category]) map[o.category] = [];
      map[o.category].push({ label: o.label, id: o.id });
    });
    return map;
  }, [options]);

  const submit = async () => {
    if (!label.trim()) return toast.error('Informe a opção');
    const exists = byCategory[category]?.some((o) => o.label.toLowerCase() === label.trim().toLowerCase());
    if (exists) return toast.error('Esta opção já existe nesta categoria');
    try {
      await create.mutateAsync({ category, label: label.trim() });
      setLabel('');
      toast.success('Opção adicionada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/semester"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Opções de Itens — Checklist Semestral</h1>
              <p className="text-sm text-muted-foreground">
                Pré-cadastre as opções que aparecem no dropdown ao adicionar itens em cada categoria.
              </p>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <Card className="border-yellow-500/40">
            <CardContent className="p-4 flex items-center gap-2 text-sm text-yellow-700">
              <ShieldAlert className="h-4 w-4" />
              Apenas administradores podem editar as opções.
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova opção</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEMESTER_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição da opção</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Trocar fechadura"
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={submit} disabled={create.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {SEMESTER_CATEGORIES.map((cat) => (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{cat}</span>
                <Badge variant="outline">{byCategory[cat]?.length ?? 0} opções</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!byCategory[cat] || byCategory[cat].length === 0) ? (
                <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {byCategory[cat].map((o, i) => (
                    <div
                      key={(o.id ?? o.label) + i}
                      className="flex items-center gap-2 border rounded-full pl-3 pr-1 py-1 text-sm bg-muted/40"
                    >
                      <span>{o.label}</span>
                      {o.fixed ? (
                        <span title="Opção padrão do sistema" className="text-muted-foreground">
                          <Lock className="h-3 w-3" />
                        </span>
                      ) : isAdmin ? (
                        <button
                          type="button"
                          className="rounded-full hover:bg-destructive/10 p-1 text-destructive"
                          title="Remover"
                          onClick={() => {
                            if (confirm(`Remover "${o.label}"?`)) {
                              del.mutate(o.id!, { onSuccess: () => toast.success('Removida') });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {isLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
      </div>
    </MainLayout>
  );
}
