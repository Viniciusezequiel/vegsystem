import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { usePsCollaborators, usePsGeneralEvaluations, usePsSaveGeneralEvaluation } from '@/hooks/useProcessoSeletivo';
import { useAuth } from '@/contexts/AuthContext';
import { PS_CLASSIFICATION_LABEL } from '@/lib/psConstants';
import { ClipboardCheck } from 'lucide-react';

export default function PsGeneralEvaluation() {
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsGeneralEvaluations();
  const saveEval = usePsSaveGeneralEvaluation();
  const { profile } = useAuth() as any;

  const [collaboratorId, setCollaboratorId] = useState('');
  const [period, setPeriod] = useState('');
  const [comments, setComments] = useState('');
  const [values, setValues] = useState(emptyCriteria());

  const submit = async () => {
    if (!collaboratorId || !period.trim()) return;
    const collaborator: any = collaborators.find((c: any) => c.id === collaboratorId);
    await saveEval.mutateAsync({
      collaborator_id: collaboratorId,
      collaborator_name: collaborator?.full_name,
      batch_name: period.trim(),
      observations: comments.trim() || null,
      evaluator_name: profile?.full_name || 'Sistema',
      ...values,
    });
    setValues(emptyCriteria());
    setComments('');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Avaliação Geral</h1>
            <p className="text-muted-foreground">Avaliações periódicas fora de um evento específico.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Nova avaliação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Colaborador *</Label>
                <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {collaborators.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Período</Label><Input placeholder="Ex.: 2026/1" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
              <PsCriteriaFields values={values} onChange={setValues} />
              <div><Label>Comentários</Label><Textarea value={comments} onChange={(e) => setComments(e.target.value)} /></div>
              <Button className="w-full" onClick={submit} disabled={saveEval.isPending || !collaboratorId}>Registrar avaliação</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Histórico</CardTitle></CardHeader>
            <CardContent className="divide-y p-0">
              {evaluations.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{e.collaborator_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.batch_name || '-'} · {new Date(e.evaluation_date || e.created_at).toLocaleDateString('pt-BR')} · {e.evaluator_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{PS_CLASSIFICATION_LABEL[e.classification] || e.classification}</Badge>
                    <Badge>{Number(e.final_score).toFixed(2)}</Badge>
                  </div>
                </div>
              ))}
              {evaluations.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma avaliação registrada.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
