import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Calendar, ClipboardCheck } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type Task,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from '@/hooks/useTasks';

export function TaskMetricCard({
  label,
  value,
  caption,
  icon: Icon = ClipboardCheck,
  tone = 'primary',
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  caption: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'amber' | 'blue' | 'emerald' | 'rose' | 'cyan';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles = {
    primary: 'border-primary/30 bg-primary/[0.07] text-primary',
    amber: 'border-amber-500/25 bg-amber-500/[0.06] text-amber-400',
    blue: 'border-blue-500/25 bg-blue-500/[0.06] text-blue-400',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400',
    rose: 'border-rose-500/25 bg-rose-500/[0.06] text-rose-400',
    cyan: 'border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group min-h-[104px] rounded-2xl border bg-card/65 p-4 text-left shadow-[0_18px_50px_-44px_rgba(124,58,237,.95)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        active && 'border-primary/35 ring-1 ring-primary/15'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', toneStyles[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
    </button>
  );
}

export function TaskWorkspaceHeader() {
  return (
    <div className="hidden grid-cols-[100px_minmax(240px,1.5fr)_170px_135px_120px_145px_44px] items-center gap-3 border-b border-border/35 bg-background/20 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground xl:grid">
      <span>Protocolo</span>
      <span>Demanda</span>
      <span>Responsável</span>
      <span>Status</span>
      <span>Prioridade</span>
      <span>Prazo</span>
      <span />
    </div>
  );
}

export function TaskWorkspaceRow({
  task,
  onOpen,
  actions,
}: {
  task: Task;
  onOpen: () => void;
  actions: ReactNode;
}) {
  const due = getTaskDueMeta(task);
  const code = taskProtocol(task);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen();
      }}
      className="group cursor-pointer px-4 py-3.5 transition hover:bg-primary/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 sm:px-5"
    >
      <div className="grid gap-3 xl:grid-cols-[100px_minmax(240px,1.5fr)_170px_135px_120px_145px_44px] xl:items-center">
        <div className="flex items-center justify-between gap-3 xl:block">
          <span className="font-mono text-[11px] font-semibold text-primary/80">{code}</span>
          <div className="xl:hidden" onClick={(event) => event.stopPropagation()}>{actions}</div>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{task.title}</p>
            {task.category && (
              <Badge variant="outline" className="h-5 border-primary/20 bg-primary/[0.06] px-1.5 text-[9px] text-primary">
                {task.category}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">Solicitada por {task.created_by_name || 'Não informado'}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-foreground/90">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background/30 text-[10px] font-semibold text-primary">
            {taskInitials(task.assigned_to_name)}
          </span>
          <span className="truncate">{task.assigned_to_name || 'Não atribuído'}</span>
        </div>

        <div>
          <Badge className={cn('whitespace-nowrap', getStatusColor(task.status))} variant="outline">
            {getStatusLabel(task.status)}
          </Badge>
        </div>
        <div>
          <Badge className={cn('whitespace-nowrap', getPriorityColor(task.priority))} variant="outline">
            {getPriorityLabel(task.priority)}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className={cn('h-3.5 w-3.5', due.isOverdue ? 'text-destructive' : 'text-muted-foreground')} />
          <div>
            <p className={cn('font-medium', due.className)}>{due.label}</p>
            {task.due_date && <p className="mt-0.5 text-[10px] text-muted-foreground">{format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}</p>}
          </div>
        </div>

        <div className="hidden xl:block" onClick={(event) => event.stopPropagation()}>{actions}</div>
      </div>
    </div>
  );
}

export function taskProtocol(task: Task) {
  return `#${task.id.slice(0, 8).toUpperCase()}`;
}

export function taskInitials(name: string | null) {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''}`.toUpperCase();
}

export function getTaskDueMeta(task: Task) {
  if (!task.due_date) return { label: 'Sem prazo', className: 'text-muted-foreground', isOverdue: false };
  const days = differenceInDays(parseISO(task.due_date), new Date());
  const closed = ['completed', 'cancelled'].includes(task.status);

  if (closed) return { label: 'Finalizada', className: 'text-muted-foreground', isOverdue: false };
  if (days < 0) return { label: `Atrasada ${Math.abs(days)}d`, className: 'text-destructive', isOverdue: true };
  if (days === 0) return { label: 'Vence hoje', className: 'text-amber-400', isOverdue: false };
  if (days <= 2) return { label: `Em ${days} dia(s)`, className: 'text-amber-400', isOverdue: false };
  return { label: `Em ${days} dias`, className: 'text-muted-foreground', isOverdue: false };
}
