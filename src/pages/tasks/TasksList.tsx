import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  Loader2,
  MoreVertical,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  UserX,
  UsersRound,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions } from '@/hooks/usePermissions';
import {
  type Task,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from '@/hooks/useTasks';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import TaskDetailsDialog from '@/components/tasks/TaskDetailsDialog';
import { TasksModuleNav } from '@/components/tasks/TasksModuleNav';
import {
  TaskMetricCard,
  TaskWorkspaceHeader,
  TaskWorkspaceRow,
  getTaskDueMeta,
  taskInitials,
  taskProtocol,
} from '@/components/tasks/TaskWorkspaceUi';

const PAGE_SIZE = 9;
type AttentionFilter = 'all' | 'overdue' | 'unassigned';

export default function TasksList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useTasks();
  const { isAdmin, isSupervisor } = useAuth();
  const { canCreate, canEdit, canDelete } = useUserPermissions();
  const deleteMutation = useDeleteTask();
  const updateMutation = useUpdateTask();
  const canPerformActions = isAdmin || isSupervisor;

  const categories = useMemo(
    () => Array.from(new Set(tasks.map(task => task.category).filter((value): value is string => Boolean(value)))).sort(),
    [tasks]
  );
  const responsibles = useMemo(
    () => Array.from(new Set(tasks.map(task => task.assigned_to_name).filter((value): value is string => Boolean(value)))).sort(),
    [tasks]
  );

  const overdueCount = tasks.filter(task => getTaskDueMeta(task).isOverdue).length;
  const pendingCount = tasks.filter(task => task.status === 'pending').length;
  const inProgressCount = tasks.filter(task => task.status === 'in_progress').length;
  const completedCount = tasks.filter(task => task.status === 'completed').length;
  const unassignedCount = tasks.filter(task => !task.assigned_to && !['completed', 'cancelled'].includes(task.status)).length;

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      if (responsibleFilter === 'unassigned' && task.assigned_to) return false;
      if (responsibleFilter !== 'all' && responsibleFilter !== 'unassigned' && task.assigned_to_name !== responsibleFilter) return false;
      if (attentionFilter === 'overdue' && !getTaskDueMeta(task).isOverdue) return false;
      if (attentionFilter === 'unassigned' && task.assigned_to) return false;
      if (!query) return true;
      return [task.title, task.description, task.created_by_name, task.assigned_to_name, task.category, task.id]
        .some(value => value?.toLowerCase().includes(query));
    });
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter, responsibleFilter, attentionFilter]);

  const teamLoad = useMemo(() => {
    const active = tasks.filter(task => !['completed', 'cancelled'].includes(task.status) && task.assigned_to_name);
    const counts = new Map<string, number>();
    active.forEach(task => counts.set(task.assigned_to_name!, (counts.get(task.assigned_to_name!) || 0) + 1));
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [tasks]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(search || statusFilter !== 'all' || priorityFilter !== 'all' || categoryFilter !== 'all' || responsibleFilter !== 'all' || attentionFilter !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setResponsibleFilter('all');
    setAttentionFilter('all');
    setPage(1);
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    updateMutation.mutate({ id: task.id, data: { status: newStatus }, oldTask: task });
  };

  const handleDelete = () => {
    if (!deleteTask) return;
    deleteMutation.mutate({ id: deleteTask.id, title: deleteTask.title });
    setDeleteTask(null);
  };

  const showAttention = (filter: AttentionFilter) => {
    setAttentionFilter(filter);
    if (filter !== 'all') setStatusFilter('all');
    setPage(1);
  };

  const exportCsv = () => {
    const rows = [
      ['Protocolo', 'Título', 'Categoria', 'Solicitante', 'Responsável', 'Prioridade', 'Status', 'Prazo'],
      ...filteredTasks.map(task => [
        taskProtocol(task),
        task.title,
        task.category || '',
        task.created_by_name || '',
        task.assigned_to_name || '',
        task.priority,
        task.status,
        task.due_date || '',
      ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `demandas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <TasksModuleNav />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Operação da equipe</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Gestão de Demandas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Visualize, distribua e acompanhe as solicitações da equipe com foco no que exige ação.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={filteredTasks.length === 0} className="h-10 gap-2 rounded-xl">
              <Download className="h-4 w-4" />Exportar
            </Button>
            {canCreate('tasks') && (
              <Button onClick={() => setFormOpen(true)} className="h-10 gap-2 rounded-xl px-4 shadow-[0_10px_32px_-18px_hsl(var(--primary))]">
                <Plus className="h-4 w-4" />Nova Demanda
              </Button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          <TaskMetricCard label="Pendentes" value={pendingCount} caption="Aguardando início" icon={ClipboardList} tone="amber" active={statusFilter === 'pending'} onClick={() => { setStatusFilter('pending'); setAttentionFilter('all'); setPage(1); }} />
          <TaskMetricCard label="Em andamento" value={inProgressCount} caption="Em execução" icon={PlayCircle} tone="blue" active={statusFilter === 'in_progress'} onClick={() => { setStatusFilter('in_progress'); setAttentionFilter('all'); setPage(1); }} />
          <TaskMetricCard label="Atrasadas" value={overdueCount} caption="Exigem atenção" icon={AlertTriangle} tone="rose" active={attentionFilter === 'overdue'} onClick={() => showAttention('overdue')} />
          <TaskMetricCard label="Sem responsável" value={unassignedCount} caption="Aguardando distribuição" icon={UserX} tone="cyan" active={attentionFilter === 'unassigned'} onClick={() => showAttention('unassigned')} />
          <TaskMetricCard label="Concluídas" value={completedCount} caption="Finalizadas" icon={CheckCircle2} tone="emerald" active={statusFilter === 'completed'} onClick={() => { setStatusFilter('completed'); setAttentionFilter('all'); setPage(1); }} />
        </section>

        <section className="rounded-2xl border border-border/45 bg-card/65 p-3 shadow-[0_20px_60px_-46px_rgba(124,58,237,.8)] backdrop-blur-xl">
          <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-[minmax(280px,1.4fr)_170px_170px_170px_190px_auto]">
            <div className="relative lg:col-span-2 2xl:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por protocolo, título, solicitante ou palavra-chave..." className="h-10 rounded-xl border-border/50 bg-background/30 pl-9" />
            </div>

            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setAttentionFilter('all'); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="on_hold">Em espera</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={responsibleFilter} onValueChange={(value) => { setResponsibleFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                <SelectItem value="unassigned">Sem responsável</SelectItem>
                {responsibles.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button variant="ghost" onClick={clearFilters} className="h-10 rounded-xl text-muted-foreground hover:text-foreground"><X className="mr-1.5 h-4 w-4" />Limpar</Button>
            ) : <div className="hidden 2xl:block" />}
          </div>
        </section>

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_290px]">
          <div className="overflow-hidden rounded-2xl border border-border/45 bg-card/65 shadow-[0_24px_70px_-54px_rgba(124,58,237,.85)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3.5 sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Demandas da equipe</h3>
                  {attentionFilter !== 'all' && <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">{attentionFilter === 'overdue' ? 'Atrasadas' : 'Sem responsável'}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredTasks.length} resultado(s) encontrado(s)</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            ) : paginatedTasks.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/20"><ClipboardList className="h-6 w-6 text-muted-foreground" /></div>
                <h3 className="mt-4 text-base font-semibold">Nenhuma demanda encontrada</h3>
                <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros para ampliar a busca.</p>
              </div>
            ) : (
              <div>
                <TaskWorkspaceHeader />
                <div className="divide-y divide-border/35">
                  {paginatedTasks.map(task => (
                    <TaskWorkspaceRow
                      key={task.id}
                      task={task}
                      onOpen={() => setViewTask(task)}
                      actions={
                        <ManagementActions
                          task={task}
                          canPerformActions={canPerformActions}
                          canEditTask={canEdit('tasks')}
                          canDeleteTask={canDelete('tasks')}
                          isAdmin={isAdmin}
                          onView={() => setViewTask(task)}
                          onEdit={() => setEditTask(task)}
                          onStatusChange={(status) => handleStatusChange(task, status)}
                          onDelete={() => setDeleteTask(task)}
                        />
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && filteredTasks.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-muted-foreground">Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredTasks.length)} de {filteredTasks.length}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage <= 1} onClick={() => setPage(previous => Math.max(1, previous - 1))} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="min-w-16 text-center text-xs font-medium text-muted-foreground">{safePage} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage >= totalPages} onClick={() => setPage(previous => Math.min(totalPages, previous + 1))} aria-label="Próxima página"><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>

          <aside className="grid gap-4 md:grid-cols-2 2xl:block 2xl:space-y-4">
            <div className="rounded-2xl border border-border/45 bg-card/65 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-primary" />Carga da equipe</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">Demandas ativas por responsável</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {teamLoad.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma demanda ativa atribuída.</p>
                ) : teamLoad.map((member, index) => {
                  const max = teamLoad[0]?.count || 1;
                  const width = Math.max(12, Math.round((member.count / max) * 100));
                  return (
                    <div key={member.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{taskInitials(member.name)}</span>
                          <span className="truncate text-foreground/90">{member.name}</span>
                        </div>
                        <span className="font-semibold tabular-nums">{member.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted/50"><div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${width}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/45 bg-card/65 p-4 backdrop-blur-xl">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-primary" />Ações rápidas</h3>
              <div className="mt-3 space-y-2">
                {canCreate('tasks') && <QuickAction icon={Plus} label="Nova Demanda" caption="Registrar solicitação" onClick={() => setFormOpen(true)} />}
                <QuickAction icon={UserRound} label="Minhas Demandas" caption="Acompanhar suas solicitações" onClick={() => navigate('/tasks/my-tasks')} />
                <QuickAction icon={AlertTriangle} label="Demandas Atrasadas" caption={`${overdueCount} exigindo atenção`} onClick={() => showAttention('overdue')} />
                <QuickAction icon={UserX} label="Sem responsável" caption={`${unassignedCount} aguardando distribuição`} onClick={() => showAttention('unassigned')} />
              </div>
            </div>
          </aside>
        </section>
      </div>

      <TaskFormDialog open={formOpen || !!editTask} onOpenChange={(open) => { if (!open) { setFormOpen(false); setEditTask(null); } }} task={editTask} />
      <TaskDetailsDialog open={!!viewTask} onOpenChange={(open) => !open && setViewTask(null)} task={viewTask} onEdit={() => { setEditTask(viewTask); setViewTask(null); }} />

      <AlertDialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Demanda</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir a demanda "{deleteTask?.title}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function ManagementActions({
  task,
  canPerformActions,
  canEditTask,
  canDeleteTask,
  isAdmin,
  onView,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  canPerformActions: boolean;
  canEditTask: boolean;
  canDeleteTask: boolean;
  isAdmin: boolean;
  onView: () => void;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onView}><Eye className="mr-2 h-4 w-4" />Ver detalhes</DropdownMenuItem>
        {canPerformActions && canEditTask && (!['completed', 'cancelled'].includes(task.status) || isAdmin) && <DropdownMenuItem onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
        {canPerformActions && (
          <>
            <DropdownMenuSeparator />
            {task.status === 'pending' && <DropdownMenuItem onClick={() => onStatusChange('in_progress')}><PlayCircle className="mr-2 h-4 w-4 text-blue-400" />Iniciar</DropdownMenuItem>}
            {task.status === 'in_progress' && <><DropdownMenuItem onClick={() => onStatusChange('completed')}><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />Concluir</DropdownMenuItem><DropdownMenuItem onClick={() => onStatusChange('on_hold')}><PauseCircle className="mr-2 h-4 w-4 text-amber-400" />Pausar</DropdownMenuItem></>}
            {task.status === 'on_hold' && <DropdownMenuItem onClick={() => onStatusChange('in_progress')}><PlayCircle className="mr-2 h-4 w-4 text-blue-400" />Retomar</DropdownMenuItem>}
            {!['completed', 'cancelled'].includes(task.status) && <DropdownMenuItem onClick={() => onStatusChange('cancelled')}><XCircle className="mr-2 h-4 w-4 text-destructive" />Cancelar</DropdownMenuItem>}
          </>
        )}
        {canPerformActions && canDeleteTask && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickAction({ icon: Icon, label, caption, onClick }: { icon: typeof Plus; label: string; caption: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-border/40 bg-background/20 p-2.5 text-left transition hover:border-primary/25 hover:bg-primary/[0.06]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-foreground">{label}</span><span className="block truncate text-[10px] text-muted-foreground">{caption}</span></span>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
