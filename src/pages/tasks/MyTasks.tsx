import { useState } from 'react';
import CommentAttachmentDisplay from '@/components/tasks/CommentAttachmentDisplay';
import CommentWithAttachments from '@/components/tasks/CommentWithAttachments';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  ClipboardCheck,
  Loader2,
  Calendar,
  Clock,
  Eye,
  Play,
  CheckCircle,
  MessageSquare,
  Send,
  AlertCircle,
  Plus,
  CalendarClock,
  MoreVertical,
  Edit,
  Trash2,
  User,
} from 'lucide-react';
import { useMyTasks, useUpdateTask, useAddTaskComment, useTaskComments, useDeleteTask, Task, getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import { toast } from 'sonner';

export default function MyTasks() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteTaskDialog, setDeleteTaskDialog] = useState<Task | null>(null);

  // Start dialog state
  const [startDialogTask, setStartDialogTask] = useState<Task | null>(null);
  const [startNote, setStartNote] = useState('');

  // Complete dialog state
  const [completeDialogTask, setCompleteDialogTask] = useState<Task | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [completeDate, setCompleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: tasks, isLoading } = useMyTasks();
  const { isAdmin } = useAuth();
  const updateMutation = useUpdateTask();
  const deleteMutation = useDeleteTask();
  const { data: comments, isLoading: loadingComments } = useTaskComments(selectedTask?.id || '');
  const addCommentMutation = useAddTaskComment();

  const filteredTasks = tasks?.filter(task => {
    if (statusFilter === 'all') return true;
    return task.status === statusFilter;
  });

  const handleStartTask = async () => {
    if (!startNote.trim()) {
      toast.error('Preencha a observação de início');
      return;
    }
    if (!startDialogTask) return;

    await updateMutation.mutateAsync({
      id: startDialogTask.id,
      data: { status: 'in_progress' },
      oldTask: startDialogTask,
    });

    // Add the start note as a comment
    await addCommentMutation.mutateAsync({
      taskId: startDialogTask.id,
      content: `📋 **Início da demanda:** ${startNote}`,
    });

    setStartDialogTask(null);
    setStartNote('');
  };

  const handleCompleteTask = async () => {
    if (!completeNote.trim()) {
      toast.error('Preencha as informações de conclusão');
      return;
    }
    if (!completeDialogTask) return;

    // Block completion before event end time for "acompanhamento" tasks
    const taskAny = completeDialogTask as Record<string, unknown>;
    if (taskAny.event_end_datetime) {
      const eventEnd = new Date(taskAny.event_end_datetime as string);
      if (new Date() < eventEnd) {
        toast.error('Esta demanda só pode ser concluída após o término do evento (' + 
          format(eventEnd, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) + ')');
        return;
      }
    }

    await updateMutation.mutateAsync({
      id: completeDialogTask.id,
      data: {
        status: 'completed',
        completed_at: completeDate ? new Date(completeDate + 'T23:59:59').toISOString() : new Date().toISOString(),
      },
      oldTask: completeDialogTask,
    });

    await addCommentMutation.mutateAsync({
      taskId: completeDialogTask.id,
      content: `✅ **Conclusão da demanda:** ${completeNote}`,
    });

    setCompleteDialogTask(null);
    setCompleteNote('');
    setCompleteDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleAddCommentWithAttachments = async (content: string, attachmentUrls: string[]) => {
    if (!selectedTask) return;
    await addCommentMutation.mutateAsync({
      taskId: selectedTask.id,
      content,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
    });
  };

  const getDueDateInfo = (dueDate: string | null) => {
    if (!dueDate) return null;
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return { text: 'Atrasada', color: 'text-red-600 dark:text-red-400' };
    if (days === 0) return { text: 'Vence hoje', color: 'text-orange-600 dark:text-orange-400' };
    if (days <= 2) return { text: `Vence em ${days} dia(s)`, color: 'text-yellow-600 dark:text-yellow-400' };
    return { text: format(parseISO(dueDate), 'dd/MM/yyyy', { locale: ptBR }), color: 'text-muted-foreground' };
  };

  const pendingCount = tasks?.filter(t => t.status === 'pending').length || 0;
  const inProgressCount = tasks?.filter(t => t.status === 'in_progress').length || 0;

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6" />
              Minhas Demandas
            </h1>
            <p className="page-subtitle">Acompanhe demandas atribuídas e da equipe</p>
          </div>
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Demanda
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Play className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-600">{tasks?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Atribuídas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Demandas Atribuídas</span>
            {filteredTasks && (
              <Badge variant="secondary">{filteredTasks.length} demanda(s)</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredTasks || filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardCheck className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma demanda atribuída</h3>
              <p className="text-muted-foreground mt-1">
                Você não possui demandas no momento
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Demanda</TableHead>
                     <TableHead>Criado por</TableHead>
                     <TableHead>Responsável</TableHead>
                     <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const dueDateInfo = getDueDateInfo(task.due_date);
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.category && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {task.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.created_by_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {task.assigned_to_name ? (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{task.assigned_to_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)} variant="outline">
                            {getPriorityLabel(task.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)} variant="outline">
                            {getStatusLabel(task.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {dueDateInfo ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className={dueDateInfo.color}>{dueDateInfo.text}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              {(!['completed', 'cancelled'].includes(task.status) || isAdmin) && (
                                <DropdownMenuItem onClick={() => setEditTask(task)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {task.status === 'pending' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setStartDialogTask(task)}>
                                    <Play className="w-4 h-4 mr-2 text-blue-500" />
                                    Iniciar
                                  </DropdownMenuItem>
                                </>
                              )}
                              {task.status === 'in_progress' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => setCompleteDialogTask(task)}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                    Concluir
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setDeleteTaskDialog(task)}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Dialog - Single Page (no tabs) */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <div className="flex gap-2 mt-2">
              {selectedTask && (
                <>
                  <Badge className={getStatusColor(selectedTask.status)} variant="outline">
                    {getStatusLabel(selectedTask.status)}
                  </Badge>
                  <Badge className={getPriorityColor(selectedTask.priority)} variant="outline">
                    {getPriorityLabel(selectedTask.priority)}
                  </Badge>
                  {selectedTask.category && (
                    <Badge variant="secondary">{selectedTask.category}</Badge>
                  )}
                </>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Description */}
              {selectedTask?.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              <Separator />

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Criado por</p>
                    <p className="font-medium">{selectedTask?.created_by_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium">{selectedTask?.assigned_to_name || 'Não atribuído'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Prazo</p>
                    <p className="font-medium">
                      {selectedTask?.due_date 
                        ? format(parseISO(selectedTask.due_date), 'dd/MM/yyyy', { locale: ptBR })
                        : 'Não definido'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {selectedTask ? format(parseISO(selectedTask.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                    </p>
                  </div>
                </div>

                {selectedTask?.started_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Iniciado em</p>
                      <p className="font-medium">
                        {format(parseISO(selectedTask.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}

                {selectedTask?.completed_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Concluído em</p>
                      <p className="font-medium">
                        {format(parseISO(selectedTask.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Event / Acompanhamento info */}
              {(() => {
                const isAcompanhamentoTask = selectedTask?.category?.toLowerCase() === 'acompanhamento';
                const eventStart = selectedTask?.event_start_datetime ? parseISO(selectedTask.event_start_datetime) : null;
                const eventEnd = selectedTask?.event_end_datetime ? parseISO(selectedTask.event_end_datetime) : null;

                if (!isAcompanhamentoTask && !eventStart && !eventEnd) {
                  return null;
                }

                return (
                  <>
                    <Separator />
                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-primary" />
                        Dados do Evento/Acompanhamento
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Data de Início</p>
                          <p className="font-medium">{eventStart ? format(eventStart, 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horário de Início</p>
                          <p className="font-medium">{eventStart ? format(eventStart, 'HH:mm', { locale: ptBR }) : 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Data de Término</p>
                          <p className="font-medium">{eventEnd ? format(eventEnd, 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horário de Término</p>
                          <p className="font-medium">{eventEnd ? format(eventEnd, 'HH:mm', { locale: ptBR }) : 'Não informado'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Responsável pelo acompanhamento</p>
                          <p className="font-medium">{selectedTask?.assigned_to_name || 'Não definido'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium">
                            {eventEnd && new Date() >= eventEnd
                              ? '✅ Evento encerrado'
                              : eventStart && new Date() >= eventStart
                                ? '🔵 Em andamento'
                                : eventStart || eventEnd
                                  ? '⏳ Aguardando início'
                                  : '⏳ Horários não informados'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {selectedTask?.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Observações</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.notes}</p>
                  </div>
                </>
              )}

              {/* Actions */}
              {(selectedTask?.status === 'pending' || selectedTask?.status === 'in_progress') && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    {selectedTask?.status === 'pending' && (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setStartDialogTask(selectedTask);
                          setSelectedTask(null);
                        }}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Iniciar Demanda
                      </Button>
                    )}
                    {selectedTask?.status === 'in_progress' && (
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setCompleteDialogTask(selectedTask);
                          setSelectedTask(null);
                        }}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Concluir Demanda
                      </Button>
                    )}
                  </div>
                </>
              )}

              {/* Comments Section */}
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comentários e Histórico
                  {comments && comments.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5">{comments.length}</Badge>
                  )}
                </h4>

                {loadingComments ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !comments || comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => {
                      const commentAny = c as Record<string, unknown>;
                      const attachmentUrls = (commentAny.attachment_urls as string[]) || [];
                      return (
                        <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{c.user_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                          <CommentAttachmentDisplay urls={attachmentUrls} />
                        </div>
                      );
                    })}
                  </div>
                )}

                <CommentWithAttachments
                  onSubmit={handleAddCommentWithAttachments}
                  isPending={addCommentMutation.isPending}
                />
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* START TASK Dialog */}
      <Dialog open={!!startDialogTask} onOpenChange={(open) => { if (!open) { setStartDialogTask(null); setStartNote(''); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600" />
              Iniciar Demanda
            </DialogTitle>
            <DialogDescription>
              {startDialogTask?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Task details summary */}
            {startDialogTask && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                {startDialogTask.description && (
                  <div>
                    <p className="text-muted-foreground font-medium">Descrição</p>
                    <p className="whitespace-pre-wrap">{startDialogTask.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium">{startDialogTask.assigned_to_name || 'Não atribuído'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prioridade</p>
                    <Badge className={getPriorityColor(startDialogTask.priority)} variant="outline">
                      {getPriorityLabel(startDialogTask.priority)}
                    </Badge>
                  </div>
                  {startDialogTask.category && (
                    <div>
                      <p className="text-muted-foreground">Categoria</p>
                      <Badge variant="secondary">{startDialogTask.category}</Badge>
                    </div>
                  )}
                  {startDialogTask.due_date && (
                    <div>
                      <p className="text-muted-foreground">Prazo</p>
                      <p className="font-medium">{format(parseISO(startDialogTask.due_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Criado por</p>
                    <p className="font-medium">{startDialogTask.created_by_name}</p>
                  </div>
                </div>
                {/* Event info for Acompanhamento */}
                {(() => {
                  const tAny = startDialogTask as Record<string, unknown>;
                  if (tAny.event_start_datetime || tAny.event_end_datetime) {
                    return (
                      <div className="border-t pt-3 mt-2 space-y-2">
                        <p className="font-medium flex items-center gap-1">
                          <CalendarClock className="w-4 h-4 text-primary" />
                          Dados do Evento
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {tAny.event_start_datetime && (
                            <div>
                              <p className="text-muted-foreground">Início</p>
                              <p className="font-medium">{format(parseISO(tAny.event_start_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          )}
                          {tAny.event_end_datetime && (
                            <div>
                              <p className="text-muted-foreground">Término</p>
                              <p className="font-medium">{format(parseISO(tAny.event_end_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                {startDialogTask.notes && (
                  <div className="border-t pt-3 mt-2">
                    <p className="text-muted-foreground font-medium">Observações</p>
                    <p className="whitespace-pre-wrap">{startDialogTask.notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="start-note">Observação de Início *</Label>
              <Textarea
                id="start-note"
                placeholder="Descreva como pretende tratar essa demanda, aceitando a tarefa ou informando a tratativa..."
                value={startNote}
                onChange={(e) => setStartNote(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Campo obrigatório. Informe como está aceitando ou qual tratativa será dada.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setStartDialogTask(null); setStartNote(''); }}>
                Cancelar
              </Button>
              <Button onClick={handleStartTask} disabled={!startNote.trim() || updateMutation.isPending || addCommentMutation.isPending}>
                {(updateMutation.isPending || addCommentMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Iniciando...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Confirmar Início</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* COMPLETE TASK Dialog */}
      <Dialog open={!!completeDialogTask} onOpenChange={(open) => { if (!open) { setCompleteDialogTask(null); setCompleteNote(''); setCompleteDate(format(new Date(), 'yyyy-MM-dd')); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Concluir Demanda
            </DialogTitle>
            <DialogDescription>
              {completeDialogTask?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Task details summary */}
            {completeDialogTask && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground">Responsável</p>
                    <p className="font-medium">{completeDialogTask.assigned_to_name || 'Não atribuído'}</p>
                  </div>
                  {completeDialogTask.category && (
                    <div>
                      <p className="text-muted-foreground">Categoria</p>
                      <Badge variant="secondary">{completeDialogTask.category}</Badge>
                    </div>
                  )}
                </div>
                {(() => {
                  const tAny = completeDialogTask as Record<string, unknown>;
                  if (tAny.event_start_datetime || tAny.event_end_datetime) {
                    return (
                      <div className="border-t pt-3 mt-2 space-y-2">
                        <p className="font-medium flex items-center gap-1">
                          <CalendarClock className="w-4 h-4 text-primary" />
                          Dados do Evento
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {tAny.event_start_datetime && (
                            <div>
                              <p className="text-muted-foreground">Início</p>
                              <p className="font-medium">{format(parseISO(tAny.event_start_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          )}
                          {tAny.event_end_datetime && (
                            <div>
                              <p className="text-muted-foreground">Término</p>
                              <p className="font-medium">{format(parseISO(tAny.event_end_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <p className="font-medium">
                              {tAny.event_end_datetime && new Date() >= new Date(tAny.event_end_datetime as string)
                                ? '✅ Evento encerrado'
                                : tAny.event_start_datetime && new Date() >= new Date(tAny.event_start_datetime as string)
                                  ? '🔵 Em andamento'
                                  : '⏳ Aguardando início'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="complete-note">Informações da Conclusão *</Label>
              <Textarea
                id="complete-note"
                placeholder="Informe se ocorreu tudo certo, se a demanda foi realizada por completo, observações finais..."
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Campo obrigatório. Detalhe o resultado da demanda.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-date">Data de Conclusão</Label>
              <Input
                id="complete-date"
                type="date"
                value={completeDate}
                onChange={(e) => setCompleteDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCompleteDialogTask(null); setCompleteNote(''); setCompleteDate(format(new Date(), 'yyyy-MM-dd')); }}>
                Cancelar
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleCompleteTask} disabled={!completeNote.trim() || updateMutation.isPending || addCommentMutation.isPending}>
                {(updateMutation.isPending || addCommentMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Concluindo...</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" /> Confirmar Conclusão</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
            <AlertDialogDescription>
              Tem certeza que deseja excluir a demanda "{deleteTaskDialog?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
