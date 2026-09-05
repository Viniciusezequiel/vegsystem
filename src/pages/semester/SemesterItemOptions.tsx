import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import {
  useItemOptions,
  useCreateItemOption,
  useUpdateItemOption,
  useDeleteItemOption,
  useSeedDefaultItemOptions,
} from '@/hooks/useSemesterChecklist';
import {
  SEMESTER_CATEGORIES,
  SEMESTER_BASE_ITEMS,
  FURNITURE_TYPES_CATEGORY,
  FURNITURE_PROBLEMS_CATEGORY,
  FURNITURE_ITEM_TYPES,
  FURNITURE_PROBLEMS,
} from '@/lib/semesterChecklistConstants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, ShieldAlert, Pencil, Check, X } from 'lucide-react';
import { SemesterModuleNav } from '@/components/semester/SemesterModuleNav';

export default function SemesterItemOptions() {
  const { isAdmin } = useAuth();
  const { data: options = [], isLoading } = useItemOptions();
  const create = useCreateItemOption();
  const update = useUpdateItemOption();
  const del = useDeleteItemOption();
  const seed = useSeedDefaultItemOptions();

  const [category, setCategory] = useState<string>(SEMESTER_CATEGORIES[0]);
  const [label, setLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [inlineAddCat, setInlineAddCat] = useState<string | null>(null);
  const [inlineAddValue, setInlineAddValue] = useState('');

  const ALL_CATS = useMemo(
    () => [...SEMESTER_CATEGORIES, FURNITURE_TYPES_CATEGORY, FURNITURE_PROBLEMS_CATEGORY],
    [],
  );

  const CAT_LABEL: Record<string, string> = {
    [FURNITURE_TYPES_CATEGORY]: 'Mobiliário — Tipos (Carteira/Cadeira/…)',
    [FURNITURE_PROBLEMS_CATEGORY]: 'Mobiliário — Problemas',
  };

  const seedTriedRef = useRef(false);
  useEffect(() => {
    if (!isAdmin || isLoading || seedTriedRef.current || seed.isPending) return;
    const existing = new Set(options.map((o) => `${o.category}::${o.label.toLowerCase()}`));
    const missing: { category: string; label: string; sort_order: number }[] = [];
    SEMESTER_CATEGORIES.forEach((cat) => {
      (SEMESTER_BASE_ITEMS[cat] ?? []).forEach((l, idx) => {
        if (!existing.has(`${cat}::${l.toLowerCase()}`)) {
          missing.push({ category: cat, label: l, sort_order: idx });
        }
      });
    });
    FURNITURE_ITEM_TYPES.forEach((l, idx) => {
      if (!existing.has(`${FURNITURE_TYPES_CATEGORY}::${l.toLowerCase()}`)) {
        missing.push({ category: FURNITURE_TYPES_CATEGORY, label: l, sort_order: idx });
      }
    });
    FURNITURE_PROBLEMS.forEach((l, idx) => {
      if (!existing.has(`${FURNITURE_PROBLEMS_CATEGORY}::${l.toLowerCase()}`)) {
        missing.push({ category: FURNITURE_PROBLEMS_CATEGORY, label: l, sort_order: idx });
      }
    });
    if (missing.length) {
      seedTriedRef.current = true;
      seed.mutate(missing, {
        onError: (e: any) => toast.error(e?.message || 'Erro ao carregar opções padrão'),
      });
    } else {
      seedTriedRef.current = true;
    }
  }, [isAdmin, isLoading, options, seed]);

  const byCategory = useMemo(() => {
    const map: Record<string, { id: string; label: string }[]> = {};
    ALL_CATS.forEach((c) => (map[c] = []));
    options.forEach((o) => {
      if (!map[o.category]) map[o.category] = [];
      map[o.category].push({ id: o.id, label: o.label });
    });
    return map;
  }, [options, ALL_CATS]);

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

  const startEdit = (id: string, current: string) => {
    setEditingId(id);
    setEditingValue(current);
  };

  const saveEdit = async (cat: string) => {
    const val = editingValue.trim();
    if (!val || !editingId) return setEditingId(null);
    const dup = byCategory[cat]?.some((o) => o.id !== editingId && o.label.toLowerCase() === val.toLowerCase());
    if (dup) return toast.error('Já existe outra opção com este nome');
    try {
      await update.mutateAsync({ id: editingId, label: val });
      toast.success('Opção atualizada');
      setEditingId(null);
      setEditingValue('');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar');
    }
  };

  const submitInline = async (cat: string) => {
    const val = inlineAddValue.trim();
    if (!val) return toast.error('Informe a opção');
    const exists = byCategory[cat]?.some((o) => o.label.toLowerCase() === val.toLowerCase());
    if (exists) return toast.error('Esta opção já existe nesta categoria');
    try {
      await create.mutateAsync({ category: cat, label: val });
      setInlineAddValue('');
      setInlineAddCat(null);
      toast.success('Opção adicionada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    }
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <SemesterModuleNav />
      </div>

      <div className="space-y-6">
        <PageHeader
          title="Opções de Itens — Checklist Semestral"
          description="Edite, renomeie ou remova as opções disponíveis nos levantamentos"
          actions={
            <Button variant="outline" asChild>
              <Link to="/semester">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          }
        />

        {!isAdmin && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-yellow-700 dark:text-yellow-300">
              <ShieldAlert className="h-4 w-4" />
              Apenas administradores podem editar as opções.
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card className="border-border/60 bg-card/65">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nova opção</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr_auto]">
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_CATS.map((c) => (
                      <SelectItem key={c} value={c}>{CAT_LABEL[c] ?? c}</SelectItem>
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
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(isLoading || seed.isPending) && options.length === 0 ? (
          <ContentState
            loading
            title="Carregando opções"
            description="Preparando as categorias do checklist semestral."
          />
        ) : (
          ALL_CATS.map((cat) => (
            <Card key={cat} className="border-border/60 bg-card/65">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span>{CAT_LABEL[cat] ?? cat}</span>
                  <Badge variant="outline">{byCategory[cat]?.length ?? 0} opções</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!byCategory[cat] || byCategory[cat].length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {byCategory[cat].map((o) => {
                      const isEditing = editingId === o.id;
                      return (
                        <div
                          key={o.id}
                          className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 py-1 pl-3 pr-1 text-sm"
                        >
                          {isEditing ? (
                            <>
                              <Input
                                autoFocus
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(cat);
                                  if (e.key === 'Escape') {
                                    setEditingId(null);
                                    setEditingValue('');
                                  }
                                }}
                                className="h-7 w-56"
                              />
                              <button
                                type="button"
                                className="rounded-full p-1 text-emerald-600 hover:bg-emerald-500/10"
                                title="Salvar"
                                onClick={() => saveEdit(cat)}
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                                title="Cancelar"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingValue('');
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{o.label}</span>
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-primary hover:bg-primary/10"
                                    title="Editar"
                                    onClick={() => startEdit(o.id, o.label)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full p-1 text-destructive hover:bg-destructive/10"
                                    title="Remover"
                                    onClick={() => {
                                      if (confirm(`Remover "${o.label}"?`)) {
                                        del.mutate(o.id, { onSuccess: () => toast.success('Removida') });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  inlineAddCat === cat ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={inlineAddValue}
                        onChange={(e) => setInlineAddValue(e.target.value)}
                        placeholder={`Nova opção em ${cat}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitInline(cat);
                          if (e.key === 'Escape') {
                            setInlineAddCat(null);
                            setInlineAddValue('');
                          }
                        }}
                        className="h-8 max-w-xs"
                      />
                      <Button size="sm" onClick={() => submitInline(cat)} disabled={create.isPending}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setInlineAddCat(null);
                          setInlineAddValue('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInlineAddCat(cat);
                        setInlineAddValue('');
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar opção
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </MainLayout>
  );
}
