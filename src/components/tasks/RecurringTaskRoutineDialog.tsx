import { useEffect, useMemo, useState } from 'react';
import { Repeat2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { type Task, useUpdateTask } from '@/hooks/useTasks';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useUsersList } from '@/hooks/useUsers';
import { cn } from '@/lib/utils';

type RecurringTask = Task & {
  recurrence_type?: string | null;
  recurrence_days?: string[] | null;
  recurrence_due_days?: number | null;
};

const weekdayOptions = [
  { value: '0', short: 'Dom', label: 'domingo' },
  { value: '1', short: 'Seg', label: 'segunda-feira' },
  { value: '2', short: 'Ter', label: 'terça-feira' },
  { value: '3', short: 'Qua', label: 'quarta-feira' },
  { value: '4', short: 'Qui', label: 'quinta-feira' },
  { value: '5', short: 'Sex', label: 'sexta-feira' },
  { value: '6', short: 'Sáb', label: 'sábado' },
];

interface RecurringTaskRoutineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: RecurringTask | null;
}

export function RecurringTaskRoutineDialog({ open, onOpenChange, task }: RecurringTaskRoutineDialogProps) {
  const { data: users } = useUsersList();
  const { data: categories } = useTaskCategories();
  const updateMutation = useUpdateTask();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normal',
    category: '',
    assigned_to: '',
    recurrence_type: 'weekly',
    recurrence_days: [] as string[],
    recurrence_due_days: '' as string,
  });

  useEffect(() => {
    if (!open || !task) return;
    setForm({
      title: task.title || '',
      description: task.description || '',
      priority: task.priority || 'normal',
      category: task.category || '',
      assigned_to: task.assigned_to || '',
      recurrence_type: task.recurrence_type || 'weekly',
      recurrence_days: task.recurrence_days || [],
      recurrence_due_days: task.recurrence_due_days == null ? '' : String(task.recurrence_due_days),
    });
  }, [open, task]);

  const deadlinePreview = useMemo(() => {
    if (form.recurrence_due_days === '') return 'Sem prazo automático';
    const offset = Number(form.recurrence_due_days);
    if (!Number.isFinite(offset)) return '';

    if (form.recurrence_type === 'weekly' && form.recurrence_days.length === 1) {
      const generationDay = Number(form.recurrence_days[0]);
      const dueDay = (generationDay + offset) % 7;
      const generationLabel = weekdayOptions.find((item) => Number(item.value) === generationDay)?.label;
      const dueLabel = weekdayOptions.find((item) => Number(item.value) === dueDay)?.label;
      if (generationLabel && dueLabel) {
        return offset === 0
          ? `Gerada na ${generationLabel} e vence no mesmo dia.`
          : `Gerada na ${generationLabel} → vence na ${dueLabel} (+${offset} dia${offset === 1 ? '' : 's'}).`;
      }
    }

    return offset === 0
      ? 'A ocorrência vence no mesmo dia em que for gerada.'
      : `A ocorrência vence ${offset} dia${offset === 1 ? '' : 's'} após cada geração.`;
  }, [form.recurrence_days, form.recurrence_due_days, form.recurrence_type]);

  if (!task) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (form.recurrence_type === 'weekly' && form.recurrence_days.length === 0) return;

    const assignee = users?.find((user) => user.user_id === form.assigned_to);
    const dueDays = form.recurrence_due_days === '' ? null : Number(form.recurrence_due_days);

    await updateMutation.mutateAsync({
      id: task.id,
      oldTask: task,
      data: {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        category: form.category || null,
        assigned_to: form.assigned_to || null,
        assigned_to_name: assignee?.full_name || null,
        recurrence_type: form.recurrence_type,
        recurrence_days: form.recurrence_type === 'weekly' ? form.recurrence_days : null,
        recurrence_due_days: Number.isFinite(dueDays as number) ? dueDays : null,
      } as any,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Editar rotina recorrente</DialogTitle>
          <DialogDescription>
            Edite o modelo da rotina. A ocorrência aberta desta semana acompanha responsável, dados e prazo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="recurring-title">Título *</Label>
            <Input
              id="recurring-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-description">Descrição</Label>
            <Textarea
              id="recurring-description"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category || '_none'} onValueChange={(value) => setForm((current) => ({ ...current, category: value === '_none' ? '' : value }))}>
                <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem categoria</SelectItem>
                  {(categories || []).map((category) => (
                    <SelectItem key={category.name} value={category.name}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={form.assigned_to || '_none'} onValueChange={(value) => setForm((current) => ({ ...current, assigned_to: value === '_none' ? '' : value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Não atribuído</SelectItem>
                {users?.filter((user) => user.is_active).map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>{user.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Ao trocar o responsável, a demanda ainda aberta desta semana também é transferida.</p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Repeat2 className="h-4 w-4 text-primary" />Programação da rotina
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Select value={form.recurrence_type} onValueChange={(value) => setForm((current) => ({ ...current, recurrence_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.recurrence_type === 'weekly' && (
                <div className="space-y-2">
                  <Label>Gerar nos dias *</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekdayOptions.map((day) => {
                      const active = form.recurrence_days.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setForm((current) => ({
                            ...current,
                            recurrence_days: active
                              ? current.recurrence_days.filter((value) => value !== day.value)
                              : [...current.recurrence_days, day.value],
                          }))}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm transition',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border/60 bg-background/40 text-foreground hover:border-primary/35',
                          )}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Prazo da ocorrência</Label>
                <Select value={form.recurrence_due_days || '_none'} onValueChange={(value) => setForm((current) => ({ ...current, recurrence_due_days: value === '_none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Sem prazo automático" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem prazo automático</SelectItem>
                    {Array.from({ length: 15 }, (_, index) => (
                      <SelectItem key={index} value={String(index)}>
                        {index === 0 ? 'No mesmo dia da geração' : `${index} dia${index === 1 ? '' : 's'} após a geração`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-lg border border-border/45 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  {deadlinePreview}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={updateMutation.isPending || !form.title.trim() || (form.recurrence_type === 'weekly' && form.recurrence_days.length === 0)}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar rotina'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
