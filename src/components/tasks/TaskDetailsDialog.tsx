import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Edit,
  Calendar,
  User,
  Clock,
  CalendarClock,
  MessageSquare,
  History,
  Send,
  Loader2,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { Task, useTaskComments, useTaskHistory, useAddTaskComment, getStatusLabel, getPriorityLabel, getStatusColor, getPriorityColor } from '@/hooks/useTasks';
import { useTaskTeamMembers, useAddTaskTeamMember, useRemoveTaskTeamMember } from '@/hooks/useTaskTeamMembers';
import { useUserPermissions } from '@/hooks/usePermissions';
import { useUsersList } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onEdit: () => void;
}

export default function TaskDetailsDialog({ open, onOpenChange, task, onEdit }: TaskDetailsDialogProps) {
  const [comment, setComment] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const { data: comments, isLoading: loadingComments } = useTaskComments(task?.id || '');
  const { data: history, isLoading: loadingHistory } = useTaskHistory(task?.id || '');
  const { data: teamMembers, isLoading: loadingTeam } = useTaskTeamMembers(task?.id || '');
  const { data: users } = useUsersList();
  const addCommentMutation = useAddTaskComment();
  const addTeamMemberMutation = useAddTaskTeamMember();
  const removeTeamMemberMutation = useRemoveTaskTeamMember();
  const { canEdit } = useUserPermissions();
  const { isAdmin, isSupervisor } = useAuth();

  if (!task) return null;

  const canManageTeam = isAdmin || isSupervisor;
  const taskAny = task as Record<string, unknown>;

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    await addCommentMutation.mutateAsync({ taskId: task.id, content: comment });
    setComment('');
  };

  const handleAddTeamMember = async () => {
    if (!selectedUserId) return;
    const selectedUser = users?.find(u => u.user_id === selectedUserId);
    if (selectedUser) {
      await addTeamMemberMutation.mutateAsync({
        taskId: task.id,
        userId: selectedUserId,
        userName: selectedUser.full_name,
      });
      setSelectedUserId('');
    }
  };

  const handleRemoveTeamMember = async (memberId: string, memberName: string) => {
    await removeTeamMemberMutation.mutateAsync({
      taskId: task.id,
      memberId,
      memberName,
    });
  };

  const availableUsers = users?.filter(u => 
    u.is_active && 
    u.user_id !== task.assigned_to &&
    !teamMembers?.some(m => m.user_id === u.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2">{task.title}</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={getStatusColor(task.status)} variant="outline">
                  {getStatusLabel(task.status)}
                </Badge>
                <Badge className={getPriorityColor(task.priority)} variant="outline">
                  {getPriorityLabel(task.priority)}
                </Badge>
                {task.category && (
                  <Badge variant="secondary">{task.category}</Badge>
                )}
              </div>
            </div>
            {canEdit('tasks') && (
              (['completed', 'cancelled'].includes(task.status) ? isAdmin : true)
            ) && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Description */}
            {task.description && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h4>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <Separator />

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Responsável</p>
                  <p className="font-medium">{task.assigned_to_name || 'Não atribuído'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Criado por</p>
                  <p className="font-medium">{task.created_by_name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Prazo</p>
                  <p className="font-medium">
                    {task.due_date 
                      ? format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR })
                      : 'Não definido'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium">
                    {format(parseISO(task.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {task.started_at && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Iniciado em</p>
                    <p className="font-medium">
                      {format(parseISO(task.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}

              {task.completed_at && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Concluído em</p>
                    <p className="font-medium">
                      {format(parseISO(task.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Event / Acompanhamento info */}
            {(task.event_start_datetime || task.event_end_datetime) && (
              <>
                <Separator />
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                    <CalendarClock className="w-4 h-4" />
                    Dados do Evento / Acompanhamento
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {task.event_start_datetime && (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-xs">Data de Início</p>
                        <p className="font-medium">{format(parseISO(task.event_start_datetime), "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p className="text-muted-foreground text-xs mt-1">Horário de Início</p>
                        <p className="font-medium">{format(parseISO(task.event_start_datetime), "HH:mm", { locale: ptBR })}</p>
                      </div>
                    )}
                    {task.event_end_datetime && (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-xs">Data de Término</p>
                        <p className="font-medium">{format(parseISO(task.event_end_datetime), "dd/MM/yyyy", { locale: ptBR })}</p>
                        <p className="text-muted-foreground text-xs mt-1">Horário de Término</p>
                        <p className="font-medium">{format(parseISO(task.event_end_datetime), "HH:mm", { locale: ptBR })}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Responsável pelo Acompanhamento</p>
                      <p className="font-medium">{task.assigned_to_name || 'Não definido'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status do Evento</p>
                      <p className="font-medium">
                        {task.event_end_datetime && new Date() >= new Date(task.event_end_datetime)
                          ? '✅ Evento encerrado'
                          : task.event_start_datetime && new Date() >= new Date(task.event_start_datetime)
                            ? '🔵 Em andamento'
                            : '⏳ Aguardando início'}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {task.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Observações</h4>
                  <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                </div>
              </>
            )}

            {/* Team Section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Equipe
                {teamMembers && teamMembers.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{teamMembers.length}</Badge>
                )}
              </h4>
              {loadingTeam ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : !teamMembers || teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum membro adicional</p>
              ) : (
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{member.user_name}</span>
                      </div>
                      {canManageTeam && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveTeamMember(member.id, member.user_name)} disabled={removeTeamMemberMutation.isPending}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManageTeam && availableUsers && availableUsers.length > 0 && (
                <div className="flex gap-2 mt-2">
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Adicionar membro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddTeamMember} disabled={!selectedUserId || addTeamMemberMutation.isPending} size="icon">
                    {addTeamMemberMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comentários
                {comments && comments.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">{comments.length}</Badge>
                )}
              </h4>
              {loadingComments ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : !comments || comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
              ) : (
                <div className="space-y-3">
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

              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Textarea
                  placeholder="Adicionar comentário..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <Button onClick={handleAddComment} disabled={!comment.trim() || addCommentMutation.isPending} size="icon" className="h-auto">
                  {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* History Section */}
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico
              </h4>
              {loadingHistory ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : !history || history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico disponível</p>
              ) : (
                <div className="relative pl-4 border-l-2 border-muted space-y-4">
                  {history.map((h) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -left-[calc(0.5rem+1px)] top-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="ml-4">
                        <p className="text-sm">
                          <span className="font-medium">{h.user_name}</span>{' '}
                          <span className="text-muted-foreground">{h.action}</span>
                        </p>
                        {h.field_changed && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {h.old_value && <><Badge variant="outline" className="text-xs mr-1">{h.old_value}</Badge> → </>}
                            <Badge variant="secondary" className="text-xs">{h.new_value}</Badge>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(parseISO(h.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
