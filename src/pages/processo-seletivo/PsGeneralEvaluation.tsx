import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';

import { PsCriteriaFields, emptyCriteria } from '@/components/processo-seletivo/PsCriteriaFields';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { usePsCollaborators, usePsGeneralEvaluations, usePsSaveGeneralEvaluation } from '@/hooks/useProcessoSeletivo';
import { PS_CLASSIFICATION_LABEL } from '@/lib/psConstants';

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
    const collaborator: any = collaborators.find((candidate: any) => candidate.id === collaboratorId);
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
      <PageHeader
        title="Avaliação Geral"
        description="Registre avaliações periódicas dos colaboradores fora de um evento específico."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Nova avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Colaborador *</Label>
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                <SelectContent>
                  {collaborators.map((collaborator: any) => (
                    <SelectItem key={collaborator.id} value={collaborator.id}>{collaborator.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Período *</Label>
              <Input placeholder="Ex.: 2026/1" value={period} onChange={event => setPeriod(event.target.value)} />
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <PsCriteriaFields values={values} onChange={setValues} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Comentários</Label>
              <Textarea rows={3} value={comments} onChange={event => setComments(event.target.value)} placeholder="Observações complementares sobre o desempenho" />
            </div>

            <Button className="w-full" onClick={() => void submit()} disabled={saveEval.isPending || !collaboratorId || !period.trim()}>
              {saveEval.isPending ? 'Registrando...' : 'Registrar avaliação'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="text-base">Histórico</CardTitle>
            <Badge variant="secondary">{evaluations.length}</Badge>
          </CardHeader>
          <CardContent>
            {evaluations.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 text-center">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/45" />
                <p className="mt-3 text-sm font-medium">Nenhuma avaliação registrada</p>
                <p className="mt-1 text-xs text-muted-foreground">As avaliações periódicas aparecerão aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {evaluations.map((evaluation: any) => (
                  <div key={evaluation.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{evaluation.collaborator_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {evaluation.batch_name || 'Sem período'} · {new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString('pt-BR')} · {evaluation.evaluator_name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{PS_CLASSIFICATION_LABEL[evaluation.classification] || evaluation.classification}</Badge>
                      <Badge>{Number(evaluation.final_score).toFixed(2)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
