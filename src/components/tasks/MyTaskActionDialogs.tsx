import { useState } from 'react';
import { CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  type Task,
  getPriorityColor,
  getPriorityLabel,
  useAddTaskComment,
  useUpdateTask,
} from '@/hooks/useTasks';

export function MyTaskActionDialogs({
  startTask,
  completeTask,
  rejectTask,
  onStartTaskChange,
  onCompleteTaskChange,
  onRejectTaskChange,
}: {
  startTask: Task | null;
  completeTask: Task | null;
  rejectTask: Task | null;
  onStartTaskChange: (task: Task | null) => void;
  onCompleteTaskChange: (task: Task | null) => void;
  onRejectTaskChange: (task: Task | null) => void;
}) {
  const [startNote, setStartNote] = useState('');
  const [completeNote, setCompleteNote] = useState('');
  const [completeDate, setCompleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rejectNote, setRejectNote] = useState('');
  const updateMutation = useUpdateTask();
  const addCommentMutation = useAddTaskComment();
  const isPending = updateMutation.isPending || addCommentMutation.isPending;

  const closeStart = () => {
    onStartTaskChange(null);
    setStartNote('');
  };

  const closeComplete = () => {
    onCompleteTaskChange(null);
    setCompleteNote('');
    setCompleteDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const closeReject = () => {
    onRejectTaskChange(null);
    setRejectNote('');
  };

  const handleStart = async () => {
    if (!startNote.trim()) {
      toast.error('Preencha a observação de início');
      return;
    }
    if (!startTask) return;

    await updateMutation.mutateAsync({ id: startTask.id, data: { status: 'in_progress' }, oldTask: startTask });
    await addCommentMutation.mutateAsync({ taskId: startTask.id, content: `📋 **Início da demanda:** ${startNote}` });
    closeStart();
  };

  const handleComplete = async () => {
    if (!completeNote.trim()) {
      toast.error('Preencha as informações de conclusão');
      return;
    }
    if (!completeTask) return;

    if (completeTask.event_end_datetime) {
      const eventEnd = new Date(completeTask.event_end_datetime);
      if (new Date() < eventEnd) {
        toast.error(`Esta demanda só pode ser concluída após o término do evento (${format(eventEnd, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })})`);
        return;
      }
    }

    await updateMutation.mutateAsync({
      id: completeTask.id,
      data: {
        status: 'completed',
        completed_at: completeDate ? new Date(`${completeDate}T23:59:59`).toISOString() : new Date().toISOString(),
      },
      oldTask: completeTask,
    });
    await addCommentMutation.mutateAsync({ taskId: completeTask.id, content: `✅ **Conclusão da demanda:** ${completeNote}` });
    closeComplete();
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    if (!rejectTask) return;

    await updateMutation.mutateAsync({ id: rejectTask.id, data: { status: 'in_progress' }, oldTask: rejectTask });
    await addCommentMutation.mutateAsync({ taskId: rejectTask.id, content: `❌ **Demanda rejeitada pelo solicitante:** ${rejectNote}` });
    closeReject();
    toast.info('Demanda devolvida para os responsáveis refazerem.');
  };

  return (
    <>
      <Dialog open={!!startTask} onOpenChange={(open) => !open && closeStart()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-blue-400" />Iniciar Demanda</DialogTitle>
            <DialogDescription>{startTask?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {startTask && <TaskSummary task={startTask} />}
            <div className="space-y-2">
              <Label htmlFor="start-note">Observação de início *</Label>
              <Textarea
                id="start-note"
                value={startNote}
                onChange={(event) => setStartNote(event.target.value)}
                placeholder="Informe a tratativa inicial e como a demanda será conduzida..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeStart}>Cancelar</Button>
              <Button onClick={handleStart} disabled={!startNote.trim() || isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar início
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeTask} onOpenChange={(open) => !open && closeComplete()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-400" />Concluir Demanda</DialogTitle>
            <DialogDescription>{completeTask?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {completeTask && <TaskSummary task={completeTask} />}
            <div className="space-y-2">
              <Label htmlFor="complete-note">Informações da conclusão *</Label>
              <Textarea
                id="complete-note"
                value={completeNote}
                onChange={(event) => setCompleteNote(event.target.value)}
                placeholder="Registre o resultado da demanda e as observações finais..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete-date">Data da conclusão</Label>
              <Input id="complete-date" type="date" value={completeDate} onChange={(event) => setCompleteDate(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeComplete}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleComplete} disabled={!completeNote.trim() || isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar conclusão
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTask} onOpenChange={(open) => !open && closeReject()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-destructive" />Rejeitar Conclusão</DialogTitle>
            <DialogDescription>{rejectTask?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-muted-foreground">
              A demanda voltará para <strong className="text-foreground">Em andamento</strong> e os responsáveis poderão corrigi-la.
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-note">Motivo da rejeição *</Label>
              <Textarea
                id="reject-note"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
                placeholder="Explique o que precisa ser corrigido..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeReject}>Cancelar</Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectNote.trim() || isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskSummary({ task }: { task: Task }) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/45 bg-muted/10 p-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsável</p>
        <p className="mt-1 font-medium">{task.assigned_to_name || 'Não atribuído'}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prioridade</p>
        <Badge className={cn('mt-1', getPriorityColor(task.priority))} variant="outline">{getPriorityLabel(task.priority)}</Badge>
      </div>
      {task.category && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Categoria</p>
          <p className="mt-1 font-medium">{task.category}</p>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prazo</p>
        <p className="mt-1 font-medium">{task.due_date ? format(parseISO(task.due_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não definido'}</p>
      </div>
    </div>
  );
}
