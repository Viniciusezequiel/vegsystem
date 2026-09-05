import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ClipboardList, Check, X, Save, AlertTriangle } from 'lucide-react';
import { useCreateShiftHandover } from '@/hooks/useShiftHandovers';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const SHIFTS = ['Manhã', 'Tarde', 'Noite'];

const DEFAULT_TASKS = [
  'Check list de sala e equipamentos',
  'Aviso para remanejamento',
  'Auditório verificado e/ou apoio audiovisual a eventos',
  'Fiscalização do fluxo de aulas',
  'Verificação dos protocolos e cobrança das pendências',
  'Protocolo de achados e perdidos',
  'Intercorrências',
  'Abertura de chamados',
];

const OBSERVATION_REQUIRED_ON_YES = [
  'Aviso para remanejamento',
  'Intercorrências',
  'Abertura de chamados',
];

const INCIDENT_TYPES = [
  'Reserva não ocorreu',
  'Reserva e/ou remanejamento de urgência',
  'Intercorrência nos equipamentos',
  'Intercorrência no preparo da reserva',
];

type TaskState = {
  task_name: string;
  answer: boolean | null;
  observation: string;
};

type IncidentState = {
  incident_type: string;
  description: string;
  location: string;
  treatment: string;
};

export default function ShiftHandoverForm() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const createHandover = useCreateShiftHandover();

  const today = new Date();
  const dayIndex = today.getDay();
  const defaultDay = DAYS_OF_WEEK[dayIndex === 0 ? 6 : dayIndex - 1];
  const currentHour = today.getHours();
  const defaultShift = currentHour < 12 ? 'Manhã' : currentHour < 18 ? 'Tarde' : 'Noite';

  const [dayOfWeek, setDayOfWeek] = useState(defaultDay);
  const [shift, setShift] = useState(defaultShift);
  const [handoverDate, setHandoverDate] = useState(format(today, 'yyyy-MM-dd'));
  const [sector, setSector] = useState('Recursos Didáticos');
  const [unit, setUnit] = useState('FCM Unidade I');
  const [hasImpactIncident, setHasImpactIncident] = useState(false);
  const [generalObservations, setGeneralObservations] = useState('');
  const [collaboratorTime, setCollaboratorTime] = useState(format(today, 'HH:mm'));

  const [tasks, setTasks] = useState<TaskState[]>(
    DEFAULT_TASKS.map(name => ({ task_name: name, answer: null, observation: '' }))
  );

  const [incidents, setIncidents] = useState<IncidentState[]>(
    INCIDENT_TYPES.map(type => ({ incident_type: type, description: '', location: '', treatment: '' }))
  );

  const updateTask = (index: number, field: keyof TaskState, value: any) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const updateIncident = (index: number, field: keyof IncidentState, value: string) => {
    setIncidents(prev => prev.map((inc, i) => i === index ? { ...inc, [field]: value } : inc));
  };

  const allTasksAnswered = tasks.every(t => t.answer !== null);
  const allNoTasksHaveObservation = tasks.every(t => {
    const isYesRequired = OBSERVATION_REQUIRED_ON_YES.includes(t.task_name);
    if (isYesRequired) {
      return t.answer !== true || t.observation.trim() !== '';
    }
    return t.answer !== false || t.observation.trim() !== '';
  });
  const hasAnyIncidentDescription = incidents.some(i => i.description.trim());
  const allDescribedIncidentsHaveTreatment = incidents.every(i => !i.description.trim() || i.treatment.trim());
  const incidentsValid = !hasImpactIncident || (hasAnyIncidentDescription && allDescribedIncidentsHaveTreatment);

  const handleSubmit = async () => {
    if (!allTasksAnswered) {
      toast.error('Preencha Sim ou Não em todas as tarefas antes de enviar.');
      return;
    }

    if (!allNoTasksHaveObservation) {
      toast.error('Preencha a observação para todas as tarefas que exigem detalhamento.');
      return;
    }

    if (hasImpactIncident) {
      const hasAnyIncident = incidents.some(i => i.description.trim());
      if (!hasAnyIncident) {
        toast.error('Descreva pelo menos uma intercorrência quando há intercorrência de impacto.');
        return;
      }
      const incidentsMissingTreatment = incidents.filter(i => i.description.trim() && !i.treatment.trim());
      if (incidentsMissingTreatment.length > 0) {
        toast.error('Preencha a tratativa para todas as intercorrências descritas.');
        return;
      }
    }

    await createHandover.mutateAsync({
      shift,
      day_of_week: dayOfWeek,
      handover_date: handoverDate,
      sector,
      unit,
      has_impact_incident: hasImpactIncident,
      general_observations: generalObservations || undefined,
      collaborator_name: profile?.full_name || 'Desconhecido',
      collaborator_time: collaboratorTime,
      tasks: tasks.map(t => ({
        task_name: t.task_name,
        answer: t.answer === true,
        observation: t.observation || undefined,
      })),
      incidents: hasImpactIncident ? incidents.filter(i => i.description || i.location).map(i => ({
        incident_type: i.incident_type,
        description: i.description || undefined,
        location: i.location || undefined,
        treatment: i.treatment || undefined,
      })) : [],
    });

    navigate('/rooms/shift-handovers');
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHeader
          title="Passagem de Plantão"
          description="Preencha o formulário de passagem de turno"
          actions={
            <Button asChild variant="outline">
              <Link to="/rooms/shift-handovers">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          }
        />

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" />
              Informações do Plantão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Dia da Semana</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select value={shift} onValueChange={setShift}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={handoverDate} onChange={e => setHandoverDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Input value={sector} onChange={e => setSector(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Input value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={collaboratorTime} onChange={e => setCollaboratorTime(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Tarefas <span className="text-sm font-normal text-muted-foreground">(obrigatório Sim ou Não)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <div key={index} className="space-y-2 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex-1 text-sm font-medium">{task.task_name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={task.answer === true ? 'default' : 'outline'}
                        onClick={() => updateTask(index, 'answer', true)}
                        className={task.answer === null ? 'border-destructive/50' : ''}
                      >
                        <Check className="mr-1 h-4 w-4" /> Sim
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={task.answer === false ? 'destructive' : 'outline'}
                        onClick={() => updateTask(index, 'answer', false)}
                        className={task.answer === null ? 'border-destructive/50' : ''}
                      >
                        <X className="mr-1 h-4 w-4" /> Não
                      </Button>
                    </div>
                  </div>
                  {(() => {
                    const isYesRequired = OBSERVATION_REQUIRED_ON_YES.includes(task.task_name);
                    const isObsRequired = isYesRequired ? task.answer === true : task.answer === false;
                    const requiredLabel = isYesRequired ? 'Sim' : 'Não';

                    return isObsRequired ? (
                      <div className="space-y-1">
                        <Input
                          placeholder={`Observação (obrigatório quando ${requiredLabel})`}
                          value={task.observation}
                          onChange={e => updateTask(index, 'observation', e.target.value)}
                          className={`text-sm ${!task.observation.trim() ? 'border-destructive' : ''}`}
                        />
                        {!task.observation.trim() && (
                          <p className="text-xs text-destructive">* Observação obrigatória para tarefas com resposta "{requiredLabel}"</p>
                        )}
                      </div>
                    ) : (
                      <Input
                        placeholder="Observação (opcional)"
                        value={task.observation}
                        onChange={e => updateTask(index, 'observation', e.target.value)}
                        className="text-sm"
                      />
                    );
                  })()}
                </div>
              ))}
              {!allTasksAnswered && (
                <p className="text-sm text-destructive">* Selecione Sim ou Não em todas as tarefas</p>
              )}
              {allTasksAnswered && !allNoTasksHaveObservation && (
                <p className="text-sm text-destructive">* Preencha as observações obrigatórias antes de continuar</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Intercorrências
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Switch
                checked={hasImpactIncident}
                onCheckedChange={setHasImpactIncident}
              />
              <Label className="font-medium">Intercorrência de Impacto?</Label>
              <Badge variant={hasImpactIncident ? 'destructive' : 'secondary'}>
                {hasImpactIncident ? 'SIM' : 'NÃO'}
              </Badge>
            </div>

            {hasImpactIncident && (
              <>
                <Separator />
                {!hasAnyIncidentDescription && (
                  <p className="text-sm text-destructive">* Preencha a descrição de pelo menos uma intercorrência</p>
                )}
                <div className="space-y-4">
                  {incidents.map((incident, index) => (
                    <div key={index} className="space-y-2 border-b border-border/60 pb-4 last:border-b-0 last:pb-0">
                      <span className="text-sm font-medium">{incident.incident_type}</span>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Descrição"
                          value={incident.description}
                          onChange={e => updateIncident(index, 'description', e.target.value)}
                          className={`text-sm ${hasImpactIncident && !hasAnyIncidentDescription ? 'border-destructive/50' : ''}`}
                        />
                        <Input
                          placeholder="Local"
                          value={incident.location}
                          onChange={e => updateIncident(index, 'location', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      {incident.description.trim() && (
                        <div className="space-y-1">
                          <Textarea
                            placeholder="Tratativa (obrigatório) - Descreva a ação tomada para resolver a intercorrência"
                            value={incident.treatment}
                            onChange={e => updateIncident(index, 'treatment', e.target.value)}
                            className={`text-sm ${!incident.treatment.trim() ? 'border-destructive' : ''}`}
                            rows={2}
                          />
                          {!incident.treatment.trim() && (
                            <p className="text-xs text-destructive">* Tratativa obrigatória para intercorrências descritas</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Observações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva observações gerais sobre o plantão..."
              value={generalObservations}
              onChange={e => setGeneralObservations(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Colaborador(a)</p>
                <p className="font-semibold">{profile?.full_name || 'Desconhecido'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Horário</p>
                <p className="font-semibold">{collaboratorTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link to="/rooms/shift-handovers">Cancelar</Link>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allTasksAnswered || !allNoTasksHaveObservation || !incidentsValid || createHandover.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {createHandover.isPending ? 'Salvando...' : 'Registrar Passagem'}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
