import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ClipboardCheck, Check, X } from 'lucide-react';
import { useRoomsList, useChecklistQuestions, useCreateChecklist } from '@/hooks/useRooms';
import { Badge } from '@/components/ui/badge';

type AnswerState = {
  [questionId: string]: {
    answer: boolean | null;
    notes: string;
  };
};

export default function ChecklistForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRoom = searchParams.get('room') || '';
  
  const [selectedRoom, setSelectedRoom] = useState(preselectedRoom);
  const [shift, setShift] = useState('');
  const [observations, setObservations] = useState('');
  const [answers, setAnswers] = useState<AnswerState>({});

  const { data: rooms } = useRoomsList();
  const { data: questions, isLoading: loadingQuestions } = useChecklistQuestions();
  const createChecklist = useCreateChecklist();

  const groupedQuestions = questions?.reduce((acc, q) => {
    const category = q.category || 'Geral';
    if (!acc[category]) acc[category] = [];
    acc[category].push(q);
    return acc;
  }, {} as Record<string, typeof questions>);

  const handleAnswerChange = (questionId: string, value: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer: value,
        notes: prev[questionId]?.notes || '',
      },
    }));
  };

  const handleNotesChange = (questionId: string, notes: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        notes,
      },
    }));
  };

  const allQuestionsAnswered = questions?.every(q => answers[q.id]?.answer !== null && answers[q.id]?.answer !== undefined);

  const handleSubmit = async () => {
    if (!selectedRoom || !shift || !allQuestionsAnswered) return;

    const answersArray = Object.entries(answers).map(([questionId, data]) => ({
      question_id: questionId,
      answer: data.answer!,
      notes: data.notes || undefined,
    }));

    await createChecklist.mutateAsync({
      room_id: selectedRoom,
      shift,
      observations: observations || undefined,
      answers: answersArray,
    });

    navigate('/rooms/checklists');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/rooms')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Checklist de Sala</h1>
            <p className="text-muted-foreground">Preencha o checklist da sala</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sala *</Label>
                <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms?.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name} - {room.campus} - {room.building}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turno *</Label>
                <Select value={shift} onValueChange={setShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manhã">Manhã</SelectItem>
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Noite">Noite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loadingQuestions ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Carregando perguntas...
            </CardContent>
          </Card>
        ) : (
          <>
            {Object.entries(groupedQuestions || {}).map(([category, categoryQuestions]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    {category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {categoryQuestions?.map((question) => {
                    const answerState = answers[question.id];
                    const isAnswered = answerState?.answer !== null && answerState?.answer !== undefined;
                    
                    return (
                      <div key={question.id} className="space-y-3 pb-4 border-b last:border-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <p className="text-sm font-medium">{question.question}</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={answerState?.answer === true ? 'default' : 'outline'}
                              className={answerState?.answer === true ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => handleAnswerChange(question.id, true)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Sim
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={answerState?.answer === false ? 'default' : 'outline'}
                              className={answerState?.answer === false ? 'bg-red-600 hover:bg-red-700' : ''}
                              onClick={() => handleAnswerChange(question.id, false)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Não
                            </Button>
                          </div>
                        </div>
                        {answerState?.answer === false && (
                          <Input
                            placeholder="Observação (motivo do 'Não')..."
                            value={answerState.notes}
                            onChange={(e) => handleNotesChange(question.id, e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle>Observações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Adicione observações gerais sobre a sala..."
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate('/rooms')}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedRoom || !shift || !allQuestionsAnswered || createChecklist.isPending}
              >
                {createChecklist.isPending ? 'Salvando...' : 'Salvar Checklist'}
              </Button>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
