import { useState } from 'react';
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
} from 'lucide-react';
import { useMyTasks, useUpdateTask, useAddTaskComment, useTaskComments, Task, getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/hooks/useTasks';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskFormDialog from '@/components/tasks/TaskFormDialog';
import { toast } from 'sonner';

export default function MyTasks() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // Start dialog state
  const [startDialogTask, setStartDialogTask] = useState<Task | null>(null);
  const [startNote, setStartNote] = useState('');

  // Complete dialog state
  const [completeDialogTask, setCompleteDialogTask] = useState<Task | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [completeHours, setCompleteHours] = useState('');
  const [completeDate, setCompleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: tasks, isLoading } = useMyTasks();
  const updateMutation = useUpdateTask();
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
        actual_hours: completeHours ? parseFloat(completeHours) : undefined,
        completed_at: completeDate ? new Date(completeDate + 'T23:59:59').toISOString() : new Date().toISOString(),
      },
      oldTask: completeDialogTask,
    });

    await addCommentMutation.mutateAsync({
      taskId: completeDialogTask.id,
      content: `✅ **Conclusão da demanda:** ${completeNote}${completeHours ? `\n⏱️ Horas trabalhadas: ${completeHours}h` : ''}`,
    });

    setCompleteDialogTask(null);
    setCompleteNote('');
    setCompleteHours('');
    setCompleteDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !selectedTask) return;
    await addCommentMutation.mutateAsync({ taskId: selectedTask.id, content: comment });
    setComment('');
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
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedTask(task)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                            {task.status === 'pending' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setStartDialogTask(task)}
                                disabled={updateMutation.isPending}
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Iniciar
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => setCompleteDialogTask(task)}
                                disabled={updateMutation.isPending}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Concluir
                              </Button>
                            )}
                          </div>
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

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
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
                </>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="comments" className="gap-1">
                <MessageSquare className="w-4 h-4" />
                Comentários
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4">
                {selectedTask?.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h4>
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.description}</p>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">Horas Estimadas</p>
                      <p className="font-medium">{selectedTask?.estimated_hours || '-'}h</p>
                    </div>
                  </div>

                  {selectedTask?.actual_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Horas Trabalhadas</p>
                        <p className="font-medium">{selectedTask.actual_hours}h</p>
                      </div>
                    </div>
                  )}

                  {selectedTask?.started_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
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
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Concluído em</p>
                        <p className="font-medium">
                          {format(parseISO(selectedTask.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedTask?.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Observações</h4>
                      <p className="text-sm whitespace-pre-wrap">{selectedTask.notes}</p>
                    </div>
                  </>
                )}

                {/* Event datetime info for acompanhamento */}
                {(() => {
                  const taskAny = selectedTask as Record<string, unknown> | null;
                  if (taskAny?.event_start_datetime || taskAny?.event_end_datetime) {
                    return (
                      <>
                        <Separator />
                        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <CalendarClock className="w-4 h-4" />
                            Evento/Acompanhamento
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {taskAny.event_start_datetime && (
                              <div>
                                <p className="text-muted-foreground">Início</p>
                                <p className="font-medium">{format(parseISO(taskAny.event_start_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                              </div>
                            )}
                            {taskAny.event_end_datetime && (
                              <div>
                                <p className="text-muted-foreground">Término</p>
                                <p className="font-medium">{format(parseISO(taskAny.event_end_datetime as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

                <Separator />

                {/* Actions */}
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
              </div>
            </TabsContent>

            <TabsContent value="comments" className="flex-1 flex flex-col mt-4 overflow-hidden">
              <ScrollArea className="flex-1 pr-4">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !comments || comments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum comentário ainda
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{c.user_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(c.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="flex gap-2 mt-4 pt-4 border-t flex-shrink-0">
                <Textarea
                  placeholder="Adicionar comentário ou atualização..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <Button 
                  onClick={handleAddComment} 
                  disabled={!comment.trim() || addCommentMutation.isPending}
                  size="icon"
                  className="h-auto"
                >
                  {addCommentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
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
      <Dialog open={!!completeDialogTask} onOpenChange={(open) => { if (!open) { setCompleteDialogTask(null); setCompleteNote(''); setCompleteHours(''); setCompleteDate(format(new Date(), 'yyyy-MM-dd')); } }}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="complete-hours">Horas Trabalhadas</Label>
                <Input
                  id="complete-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="Ex: 2.5"
                  value={completeHours}
                  onChange={(e) => setCompleteHours(e.target.value)}
                />
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
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setCompleteDialogTask(null); setCompleteNote(''); setCompleteHours(''); setCompleteDate(format(new Date(), 'yyyy-MM-dd')); }}>
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
        open={formOpen} 
        onOpenChange={setFormOpen}
      />
    </MainLayout>
  );
}
