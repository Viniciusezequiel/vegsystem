import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  ClipboardList,
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  PlayCircle,
  CheckCircle,
  PauseCircle,
  XCircle,
  Calendar,
  User,
  Filter,
} from 'lucide-react';
import { useTasks, useDeleteTask, useUpdateTask, Task, getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/hooks/useTasks';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import TaskDetailsDialog from '@/components/tasks/TaskDetailsDialog';

export default function TasksList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);

  const { data: tasks, isLoading } = useTasks({
    status: statusFilter,
    priority: priorityFilter,
    search: search || undefined,
  });

  const { isAdmin, isSupervisor } = useAuth();
  const { canCreate, canEdit, canDelete } = useUserPermissions();
  const deleteMutation = useDeleteTask();
  const updateMutation = useUpdateTask();

  // Only admin and supervisor can perform actions in this view
  const canPerformActions = isAdmin || isSupervisor;

  const handleStatusChange = (task: Task, newStatus: string) => {
    updateMutation.mutate({
      id: task.id,
      data: { status: newStatus as any },
      oldTask: task,
    });
  };

  const handleDelete = () => {
    if (deleteTask) {
      deleteMutation.mutate({ id: deleteTask.id, title: deleteTask.title });
      setDeleteTask(null);
    }
  };

  const getDueDateColor = (dueDate: string | null, status?: string) => {
    if (!dueDate) return '';
    if (status === 'completed' || status === 'cancelled') return '';
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-destructive font-medium';
    if (isToday(date)) return 'text-orange-600 font-medium';
    return '';
  };

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Gestão de Demandas
            </h1>
            <p className="page-subtitle">Acompanhe todas as demandas da equipe</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar demandas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="on_hold">Em Espera</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prioridades</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>

            {(search || statusFilter !== 'all' || priorityFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Demandas</span>
            {tasks && <Badge variant="secondary">{tasks.length} registro(s)</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma demanda encontrada</h3>
              <p className="text-muted-foreground mt-1">
                Crie uma nova demanda para começar
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewTask(task)}>
                      <TableCell className="font-medium max-w-[250px]">
                        <div className="truncate">{task.title}</div>
                        {task.category && (
                          <span className="text-xs text-muted-foreground">{task.category}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)} variant="outline">
                          {getStatusLabel(task.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)} variant="outline">
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.assigned_to_name ? (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{task.assigned_to_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Não atribuído</span>
                        )}
                      </TableCell>
                      <TableCell className={getDueDateColor(task.due_date, task.status)}>
                        {task.due_date ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.created_by_name}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewTask(task)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            {canPerformActions && canEdit('tasks') && (
                              // After completed/cancelled, only admin can edit
                              !(['completed', 'cancelled'].includes(task.status)) || isAdmin
                            ) && (
                              <DropdownMenuItem onClick={() => setEditTask(task)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canPerformActions && (
                              <>
                                <DropdownMenuSeparator />
                                {task.status === 'pending' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'in_progress')}>
                                    <PlayCircle className="w-4 h-4 mr-2 text-blue-500" />
                                    Iniciar
                                  </DropdownMenuItem>
                                )}
                                {task.status === 'in_progress' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleStatusChange(task, 'completed')}>
                                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                      Concluir
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleStatusChange(task, 'on_hold')}>
                                      <PauseCircle className="w-4 h-4 mr-2 text-orange-500" />
                                      Pausar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {task.status === 'on_hold' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'in_progress')}>
                                    <PlayCircle className="w-4 h-4 mr-2 text-blue-500" />
                                    Retomar
                                  </DropdownMenuItem>
                                )}
                                {!['completed', 'cancelled'].includes(task.status) && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'cancelled')}>
                                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {canPerformActions && canDelete('tasks') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteTask(task)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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

      <TaskDetailsDialog
        open={!!viewTask}
        onOpenChange={(open) => !open && setViewTask(null)}
        task={viewTask}
        onEdit={() => {
          setEditTask(viewTask);
          setViewTask(null);
        }}
      />

      <AlertDialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Demanda</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a demanda "{deleteTask?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
