import { useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, CheckCircle2, ChevronDown, Edit3, Repeat2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import { type Task, getStatusColor, getStatusLabel, useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

type RecurringTask = Task & {
  recurrence_parent_id?: string | null;
  recurrence_last_run_date?: string | null;
  recurrence_type?: string | null;
  recurrence_days?: string[] | null;
};

const weekDays: Record<string, string> = {
  '0': 'domingo',
  '1': 'segunda-feira',
  '2': 'terça-feira',
  '3': 'quarta-feira',
  '4': 'quinta-feira',
  '5': 'sexta-feira',
  '6': 'sábado',
};

function recurrenceLabel(task: RecurringTask) {
  if (task.recurrence_type === 'daily') return 'Todos os dias';
  if (task.recurrence_type === 'weekly') {
    const days = (task.recurrence_days || []).map((day) => weekDays[String(day)]).filter(Boolean);
    return days.length ? `Toda ${days.join(', ')}` : 'Semanal';
  }
  if (task.recurrence_type === 'monthly') return 'Mensal';
  if (task.recurrence_type === 'semiannual') return 'Semestral';
  return 'Recorrente';
}

function nextOccurrence(task: RecurringTask) {
  const today = startOfDay(new Date());
  const lastRunToday = task.recurrence_last_run_date === format(today, 'yyyy-MM-dd');

  if (task.recurrence_type === 'daily') return addDays(today, lastRunToday ? 1 : 0);

  if (task.recurrence_type === 'weekly') {
    const selected = new Set((task.recurrence_days || []).map(String));
    if (!selected.size) return addDays(today, lastRunToday ? 7 : 0);
    for (let offset = lastRunToday ? 1 : 0; offset <= 7; offset += 1) {
      const candidate = addDays(today, offset);
      if (selected.has(String(candidate.getDay()))) return candidate;
    }
  }

  if (task.recurrence_type === 'monthly') {
    const targetDay = parseISO(task.created_at).getDate();
    for (let offset = lastRunToday ? 1 : 0; offset <= 35; offset += 1) {
      const candidate = addDays(today, offset);
      if (candidate.getDate() === targetDay) return candidate;
    }
  }

  return null;
}

export function RecurringTasksControl() {
  const { data: tasks = [], isLoading } = useTasks();
  const [open, setOpen] = useState(true);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const templates = useMemo(
    () => (tasks as RecurringTask[]).filter((task) => Boolean(task.recurrence_type)),
    [tasks],
  );

  const historyByParent = useMemo(() => {
    const map = new Map<string, RecurringTask[]>();
    for (const task of tasks as RecurringTask[]) {
      if (!task.recurrence_parent_id) continue;
      const current = map.get(task.recurrence_parent_id) || [];
      current.push(task);
      map.set(task.recurrence_parent_id, current);
    }
    for (const history of map.values()) {
      history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [tasks]);

  if (isLoading) return null;

  return (
    <>
      <section className="mt-3 overflow-hidden rounded-2xl border border-primary/20 bg-card/65 shadow-[0_18px_50px_-46px_rgba(124,58,237,.9)] backdrop-blur-xl">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-primary/[0.04]"
          onClick={() => setOpen((value) => !value)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <Repeat2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Demandas recorrentes</p>
                <Badge variant="outline" className="h-5 rounded-full border-primary/25 bg-primary/[0.06] px-2 text-[9px] text-primary">
                  {templates.length} ativa(s)
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Controle das rotinas semanais e demais recorrências automáticas.</p>
            </div>
          </div>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="border-t border-border/35 p-3">
            {!templates.length ? (
              <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-xs text-muted-foreground">
                Nenhuma demanda recorrente configurada.
              </div>
            ) : (
              <div className="grid gap-2 xl:grid-cols-2">
                {templates.map((template) => {
                  const history = historyByParent.get(template.id) || [];
                  const latest = history[0];
                  const next = nextOccurrence(template);
                  const generatedToday = template.recurrence_last_run_date === format(new Date(), 'yyyy-MM-dd');

                  return (
                    <article key={template.id} className="rounded-xl border border-border/45 bg-background/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{template.title}</p>
                            <Badge variant="outline" className="h-5 rounded-full text-[9px]">{recurrenceLabel(template)}</Badge>
                            {generatedToday && (
                              <Badge className="h-5 rounded-full bg-emerald-600 text-[9px] hover:bg-emerald-600">
                                <CheckCircle2 className="mr-1 h-3 w-3" />Gerada hoje
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Responsável: <span className="font-medium text-foreground/85">{template.assigned_to_name || 'Não atribuído'}</span>
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 shrink-0 rounded-lg px-2 text-[10px]" onClick={() => setEditTask(template)}>
                          <Edit3 className="mr-1.5 h-3.5 w-3.5" />Editar rotina
                        </Button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-border/35 bg-card/40 p-2">
                          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Última geração</p>
                          <p className="mt-1 text-[11px] font-medium">{template.recurrence_last_run_date ? format(parseISO(template.recurrence_last_run_date), 'dd/MM/yyyy') : 'Nunca'}</p>
                        </div>
                        <div className="rounded-lg border border-border/35 bg-card/40 p-2">
                          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Próxima</p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium"><CalendarClock className="h-3 w-3 text-primary" />{next ? format(next, 'dd/MM/yyyy', { locale: ptBR }) : 'Conforme regra'}</p>
                        </div>
                        <div className="rounded-lg border border-border/35 bg-card/40 p-2">
                          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Execuções</p>
                          <p className="mt-1 text-[11px] font-medium">{history.length}</p>
                        </div>
                        <div className="rounded-lg border border-border/35 bg-card/40 p-2">
                          <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Última demanda</p>
                          {latest ? (
                            <Badge variant="outline" className={cn('mt-1 h-5 whitespace-nowrap text-[8px]', getStatusColor(latest.status))}>{getStatusLabel(latest.status)}</Badge>
                          ) : (
                            <p className="mt-1 text-[11px] font-medium text-muted-foreground">Sem histórico</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <TaskFormDialog
        open={!!editTask}
        onOpenChange={(value) => !value && setEditTask(null)}
        task={editTask}
      />
    </>
  );
}
