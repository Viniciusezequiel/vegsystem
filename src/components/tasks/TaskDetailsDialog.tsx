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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  // Filter out users who are already team members or the main assignee
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
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="details" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="team" className="gap-1">
                <Users className="w-4 h-4" />
                Equipe
                {teamMembers && teamMembers.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {teamMembers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-1">
                <MessageSquare className="w-4 h-4" />
                Comentários
                {comments && comments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {comments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-1" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex-1 overflow-auto mt-4">
              <div className="space-y-4">
                {task.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Descrição</h4>
                    <p className="text-sm whitespace-pre-wrap">{task.description}</p>
                  </div>
                )}

                <Separator />

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

                  {task.estimated_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Horas Estimadas</p>
                        <p className="font-medium">{task.estimated_hours}h</p>
                      </div>
                    </div>
                  )}

                  {task.actual_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Horas Trabalhadas</p>
                        <p className="font-medium">{task.actual_hours}h</p>
                      </div>
                    </div>
                  )}

                  {task.started_at && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
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
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Concluído em</p>
                        <p className="font-medium">
                          {format(parseISO(task.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {task.notes && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Observações</h4>
                      <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="team" className="flex-1 flex flex-col mt-4 overflow-hidden">
              <div className="space-y-4">
                {/* Main Assignee */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Responsável Principal</h4>
                  {task.assigned_to_name ? (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{task.assigned_to_name}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não atribuído</p>
                  )}
                </div>

                <Separator />

                {/* Team Members */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Equipe Envolvida</h4>
                  {loadingTeam ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !teamMembers || teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum membro adicional na equipe</p>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{member.user_name}</span>
                          </div>
                          {canManageTeam && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveTeamMember(member.id, member.user_name)}
                              disabled={removeTeamMemberMutation.isPending}
                            >
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Team Member */}
                {canManageTeam && availableUsers && availableUsers.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Adicionar Membro</h4>
                      <div className="flex gap-2">
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um usuário..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableUsers.map((user) => (
                              <SelectItem key={user.user_id} value={user.user_id}>
                                {user.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={handleAddTeamMember}
                          disabled={!selectedUserId || addTeamMemberMutation.isPending}
                        >
                          {addTeamMemberMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
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
                  placeholder="Adicionar comentário..."
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

            <TabsContent value="history" className="flex-1 overflow-auto mt-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !history || history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum histórico disponível
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <div className="flex-1">
                        <p>
                          <span className="font-medium">{h.user_name}</span>{' '}
                          <span className="text-muted-foreground">{h.action}</span>
                          {h.field_changed && (
                            <span className="text-muted-foreground">
                              {' '}- {h.old_value} → {h.new_value}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
