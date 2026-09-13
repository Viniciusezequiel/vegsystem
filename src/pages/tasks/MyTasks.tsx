import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Edit3,
  Eye,
  Loader2,
  MoreVertical,
  Play,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
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
import {
  type Task,
  useDeleteTask,
  useMyTasks,
} from '@/hooks/useTasks';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import TaskDetailsDialog from '@/components/tasks/TaskDetailsDialog';
import { TasksModuleNav } from '@/components/tasks/TasksModuleNav';
import {
  TaskMetricCard,
  TaskWorkspaceHeader,
  TaskWorkspaceRow,
} from '@/components/tasks/TaskWorkspaceUi';
import { MyTaskActionDialogs } from '@/components/tasks/MyTaskActionDialogs';

const PAGE_SIZE = 8;

export default function MyTasks() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldOpen = params.get('new') === '1';
    if (shouldOpen) {
      params.delete('new');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    }
    return shouldOpen;
  });
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<Task | null>(null);
  const [startTask, setStartTask] = useState<Task | null>(null);
  const [completeTask, setCompleteTask] = useState<Task | null>(null);
  const [rejectTask, setRejectTask] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useMyTasks();
  const { isAdmin, user } = useAuth();
  const deleteMutation = useDeleteTask();

  const categories = useMemo(
    () => Array.from(new Set(tasks.map(task => task.category).filter((value): value is string => Boolean(value)))).sort(),
    [tasks]
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      if (!query) return true;
      return [task.title, task.description, task.created_by_name, task.assigned_to_name, task.category, task.id]
        .some(value => value?.toLowerCase().includes(query));
    });
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter]);

  const pendingCount = tasks.filter(task => task.status === 'pending').length;
  const inProgressCount = tasks.filter(task => task.status === 'in_progress').length;
  const completedCount = tasks.filter(task => task.status === 'completed').length;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const hasFilters = Boolean(search || statusFilter !== 'all' || categoryFilter !== 'all' || priorityFilter !== 'all');

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <TasksModuleNav />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">Demandas</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Minhas Demandas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe, filtre e gerencie suas solicitações em um único painel.</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="h-10 gap-2 rounded-xl px-4 shadow-[0_10px_32px_-18px_hsl(var(--primary))]">
            <Plus className="h-4 w-4" />
            Nova Demanda
          </Button>
        </section>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <TaskMetricCard
            label="Minhas demandas"
            value={tasks.length}
            caption="Total de solicitações"
            icon={ClipboardCheck}
            active={statusFilter === 'all'}
            onClick={() => { setStatusFilter('all'); setPage(1); }}
          />
          <TaskMetricCard
            label="Abertas"
            value={pendingCount}
            caption="Aguardando atendimento"
            icon={Clock3}
            tone="amber"
            active={statusFilter === 'pending'}
            onClick={() => { setStatusFilter('pending'); setPage(1); }}
          />
          <TaskMetricCard
            label="Em andamento"
            value={inProgressCount}
            caption="Em execução"
            icon={Play}
            tone="blue"
            active={statusFilter === 'in_progress'}
            onClick={() => { setStatusFilter('in_progress'); setPage(1); }}
          />
          <TaskMetricCard
            label="Concluídas"
            value={completedCount}
            caption="Finalizadas"
            icon={CheckCircle2}
            tone="emerald"
            active={statusFilter === 'completed'}
            onClick={() => { setStatusFilter('completed'); setPage(1); }}
          />
        </section>

        <section className="rounded-2xl border border-border/45 bg-card/65 p-3 shadow-[0_20px_60px_-46px_rgba(124,58,237,.8)] backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_180px_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Buscar por título, descrição ou responsável..."
                className="h-10 rounded-xl border-border/50 bg-background/30 pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="on_hold">Em espera</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
                <SelectItem value="rejected">Rejeitadas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(1); }}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/30"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button variant="ghost" onClick={resetFilters} className="h-10 rounded-xl text-muted-foreground hover:text-foreground">
                <X className="mr-1.5 h-4 w-4" />Limpar
              </Button>
            ) : <div className="hidden xl:block" />}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/45 bg-card/65 shadow-[0_24px_70px_-54px_rgba(124,58,237,.85)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3.5 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Demandas atribuídas</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{filteredTasks.length} resultado(s) encontrado(s)</p>
            </div>
            {hasFilters && <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">Filtros ativos</Badge>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
          ) : paginatedTasks.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-muted/20">
                <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-base font-semibold">Nenhuma demanda encontrada</h3>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou registre uma nova solicitação.</p>
            </div>
          ) : (
            <div>
              <TaskWorkspaceHeader />
              <div className="divide-y divide-border/35">
                {paginatedTasks.map(task => (
                  <TaskWorkspaceRow
                    key={task.id}
                    task={task}
                    onOpen={() => setSelectedTask(task)}
                    actions={
                      <MyTaskActions
                        task={task}
                        isAdmin={isAdmin}
                        isCreator={task.created_by === user?.id}
                        onOpen={() => setSelectedTask(task)}
                        onEdit={() => setEditTask(task)}
                        onStart={() => setStartTask(task)}
                        onComplete={() => setCompleteTask(task)}
                        onReject={() => setRejectTask(task)}
                        onDelete={() => setDeleteTaskDialog(task)}
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
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage <= 1} onClick={() => setPage(previous => Math.max(1, previous - 1))} aria-label="Página anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-16 text-center text-xs font-medium text-muted-foreground">{safePage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" disabled={safePage >= totalPages} onClick={() => setPage(previous => Math.min(totalPages, previous + 1))} aria-label="Próxima página">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <TaskDetailsDialog
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        task={selectedTask}
        onEdit={() => {
          setEditTask(selectedTask);
          setSelectedTask(null);
        }}
      />

      <MyTaskActionDialogs
        startTask={startTask}
        completeTask={completeTask}
        rejectTask={rejectTask}
        onStartTaskChange={setStartTask}
        onCompleteTaskChange={setCompleteTask}
        onRejectTaskChange={setRejectTask}
      />

      <TaskFormDialog
        open={formOpen || !!editTask}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditTask(null);
          }
        }}
        task={editTask}
      />

      <AlertDialog open={!!deleteTaskDialog} onOpenChange={(open) => !open && setDeleteTaskDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Demanda</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir a demanda "{deleteTaskDialog?.title}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTaskDialog) {
                  deleteMutation.mutate({ id: deleteTaskDialog.id, title: deleteTaskDialog.title });
                  setDeleteTaskDialog(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function MyTaskActions({
  task,
  isAdmin,
  isCreator,
  onOpen,
  onEdit,
  onStart,
  onComplete,
  onReject,
  onDelete,
}: {
  task: Task;
  isAdmin: boolean;
  isCreator: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onOpen}><Eye className="mr-2 h-4 w-4" />Ver detalhes</DropdownMenuItem>
        {(!['completed', 'cancelled'].includes(task.status) || isAdmin) && <DropdownMenuItem onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
        {task.status === 'pending' && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onStart}><Play className="mr-2 h-4 w-4 text-blue-400" />Iniciar</DropdownMenuItem></>}
        {task.status === 'in_progress' && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onComplete}><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />Concluir</DropdownMenuItem></>}
        {task.status === 'completed' && isCreator && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onReject}><XCircle className="mr-2 h-4 w-4 text-destructive" />Rejeitar conclusão</DropdownMenuItem></>}
        {isAdmin && <><DropdownMenuSeparator /><DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
