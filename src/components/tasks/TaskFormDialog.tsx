import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Loader2, Save, CalendarClock, Repeat } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCreateTask, useUpdateTask, Task } from '@/hooks/useTasks';
import { useUsersList } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskCategories, type TaskCategoryConfig } from '@/hooks/useTaskCategories';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}

export default function TaskFormDialog({ open, onOpenChange, task }: TaskFormDialogProps) {
  const { isAdmin } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal',
    category: '',
    due_date: '',
    due_time: '',
    assigned_to: '',
    estimated_hours: '',
    notes: '',
    event_start_datetime: '',
    event_start_time: '',
    event_end_datetime: '',
    event_end_time: '',
    is_recurring: false,
    recurrence_type: '',
  });

  const { data: users } = useUsersList();
  const { data: categoryConfigs } = useTaskCategories();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();

  const isEditing = !!task;
  const canChangeAssignee = !isEditing || isAdmin;
  
  const currentCategoryConfig = categoryConfigs?.find(c => c.name.toLowerCase() === formData.category.toLowerCase());
  const isAcompanhamento = formData.category.toLowerCase() === 'acompanhamento';
  const requiredFields = currentCategoryConfig?.requiredFields || [];

  useEffect(() => {
    if (task) {
      const taskAny = task as Record<string, unknown>;
      const eventStart = taskAny.event_start_datetime ? new Date(taskAny.event_start_datetime as string) : null;
      const eventEnd = taskAny.event_end_datetime ? new Date(taskAny.event_end_datetime as string) : null;
      const recurrence = (taskAny.recurrence_type as string) || '';

      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'normal',
        category: task.category || '',
        due_date: task.due_date || '',
        due_time: '',
        assigned_to: task.assigned_to || '',
        estimated_hours: task.estimated_hours?.toString() || '',
        notes: task.notes || '',
        event_start_datetime: eventStart ? eventStart.toISOString().split('T')[0] : '',
        event_start_time: eventStart ? eventStart.toTimeString().slice(0, 5) : '',
        event_end_datetime: eventEnd ? eventEnd.toISOString().split('T')[0] : '',
        event_end_time: eventEnd ? eventEnd.toTimeString().slice(0, 5) : '',
        is_recurring: !!recurrence,
        recurrence_type: recurrence,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'normal',
        category: '',
        due_date: '',
        due_time: '',
        assigned_to: '',
        estimated_hours: '',
        notes: '',
        event_start_datetime: '',
        event_start_time: '',
        event_end_datetime: '',
        event_end_time: '',
        is_recurring: false,
        recurrence_type: '',
      });
    }
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields for category
    if (requiredFields.includes('description') && !formData.description.trim()) {
      return;
    }
    if (requiredFields.includes('assigned_to') && !formData.assigned_to) {
      return;
    }
    if (requiredFields.includes('due_date') && !formData.due_date) {
      return;
    }
    if (requiredFields.includes('notes') && !formData.notes.trim()) {
      return;
    }
    e.preventDefault();

    const assignedUser = users?.find(u => u.user_id === formData.assigned_to);
    
    let eventStartISO: string | undefined;
    let eventEndISO: string | undefined;

    if (isAcompanhamento) {
      if (formData.event_start_datetime && formData.event_start_time) {
        eventStartISO = new Date(`${formData.event_start_datetime}T${formData.event_start_time}:00`).toISOString();
      }
      if (formData.event_end_datetime && formData.event_end_time) {
        eventEndISO = new Date(`${formData.event_end_datetime}T${formData.event_end_time}:00`).toISOString();
      }
    }

    const data: Record<string, unknown> = {
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority,
      category: formData.category || undefined,
      due_date: formData.due_date || undefined,
      assigned_to: formData.assigned_to || undefined,
      assigned_to_name: assignedUser?.full_name || undefined,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : undefined,
      notes: formData.notes || undefined,
      event_start_datetime: eventStartISO || null,
      event_end_datetime: eventEndISO || null,
      recurrence_type: formData.is_recurring && formData.recurrence_type ? formData.recurrence_type : null,
    };

    if (isEditing) {
      await updateMutation.mutateAsync({ id: task.id, data, oldTask: task });
    } else {
      await createMutation.mutateAsync(data as any);
    }

    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize as informações da demanda' : 'Preencha os dados para criar uma nova demanda'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título da demanda"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição {requiredFields.includes('description') && '*'}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva a demanda em detalhes..."
              rows={3}
              required={requiredFields.includes('description')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={formData.category || '_none'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value === '_none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem categoria</SelectItem>
                  {(categoryConfigs || []).map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Responsável {requiredFields.includes('assigned_to') && '*'}</Label>
              <Select
                value={formData.assigned_to || '_none'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value === '_none' ? '' : value }))}
                disabled={!canChangeAssignee}
              >
                <SelectTrigger className={!canChangeAssignee ? 'opacity-60' : ''}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não atribuído</SelectItem>
                  {users?.filter(u => u.is_active).map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!canChangeAssignee && (
                <p className="text-xs text-muted-foreground">
                  Apenas administradores podem alterar o responsável
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Prazo {requiredFields.includes('due_date') && '*'}</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <DatePickerInput
                    value={formData.due_date}
                    onChange={(value) => setFormData(prev => ({ ...prev, due_date: value }))}
                    placeholder="Data"
                  />
                </div>
                <Input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                  className="w-[110px]"
                  placeholder="Hora"
                />
              </div>
            </div>
          </div>

          {/* Event datetime fields - show when category requires it or is Acompanhamento */}
          {(isAcompanhamento || requiredFields.includes('event_datetime')) && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CalendarClock className="w-4 h-4" />
                Dados do Evento/Acompanhamento
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início do Evento *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={formData.event_start_datetime}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_start_datetime: e.target.value }))}
                      required={isAcompanhamento}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={formData.event_start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_start_time: e.target.value }))}
                      required={isAcompanhamento}
                      className="w-[110px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Término do Evento *</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={formData.event_end_datetime}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_end_datetime: e.target.value }))}
                      required={isAcompanhamento}
                      className="flex-1"
                    />
                    <Input
                      type="time"
                      value={formData.event_end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_end_time: e.target.value }))}
                      required={isAcompanhamento}
                      className="w-[110px]"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A demanda só poderá ser concluída após o horário de término do evento.
              </p>
            </div>
          )}

          {/* Recurrence fields */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Repeat className="w-4 h-4 text-primary" />
                Repetir Demanda
              </div>
              <Switch
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  is_recurring: checked, 
                  recurrence_type: checked ? prev.recurrence_type || 'weekly' : '' 
                }))}
              />
            </div>
            {formData.is_recurring && (
              <div className="space-y-2">
                <Label>Frequência *</Label>
                <Select
                  value={formData.recurrence_type || 'weekly'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, recurrence_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a frequência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="semiannual">Semestral</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A demanda será recriada automaticamente na frequência selecionada.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações {requiredFields.includes('notes') && '*'}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações adicionais..."
              rows={2}
              required={requiredFields.includes('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Demanda'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
