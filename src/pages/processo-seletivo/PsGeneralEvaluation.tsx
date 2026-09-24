import { useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Download,
  FilterX,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
import { PS_CLASSIFICATION_LABEL, PS_CRITERIA } from '@/lib/psConstants';

export default function PsGeneralEvaluation() {
  const { data: collaborators = [] } = usePsCollaborators();
  const { data: evaluations = [] } = usePsGeneralEvaluations();
  const saveEval = usePsSaveGeneralEvaluation();
  const { profile } = useAuth() as any;

  const [collaboratorId, setCollaboratorId] = useState('');
  const [period, setPeriod] = useState('');
  const [comments, setComments] = useState('');
  const [values, setValues] = useState(emptyCriteria());
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState('all');

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

  const summary = useMemo(() => {
    const scores = evaluations
      .map((evaluation: any) => Number(evaluation.final_score || 0))
      .filter((score) => score > 0);

    const criteria = PS_CRITERIA.map((criterion) => {
      const criterionValues = evaluations
        .map((evaluation: any) => Number(evaluation[criterion.key] || 0))
        .filter((value) => value > 0);

      return {
        key: criterion.key,
        label: criterion.label,
        average: criterionValues.length
          ? criterionValues.reduce((sum, value) => sum + value, 0) / criterionValues.length
          : 0,
        responses: criterionValues.length,
      };
    });

    const ratedCriteria = criteria.filter((criterion) => criterion.responses > 0);

    return {
      total: evaluations.length,
      people: new Set(evaluations.map((evaluation: any) => evaluation.collaborator_id).filter(Boolean)).size,
      average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      attention: evaluations.filter((evaluation: any) =>
        ['regular', 'insuficiente', 'critico'].includes(String(evaluation.classification || ''))
      ).length,
      excellent: evaluations.filter((evaluation: any) => evaluation.classification === 'excelente').length,
      good: evaluations.filter((evaluation: any) => evaluation.classification === 'bom').length,
      criteria,
      weakestCriterion: ratedCriteria.length
        ? [...ratedCriteria].sort((a, b) => a.average - b.average)[0]
        : null,
      strongestCriterion: ratedCriteria.length
        ? [...ratedCriteria].sort((a, b) => b.average - a.average)[0]
        : null,
    };
  }, [evaluations]);

  const periodOptions = useMemo(
    () => [...new Set(
      evaluations
        .map((evaluation: any) => String(evaluation.batch_name || '').trim())
        .filter(Boolean)
    )].sort((a, b) => b.localeCompare(a, 'pt-BR', { numeric: true })),
    [evaluations]
  );

  const filtered = useMemo(() => {
    const query = search
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    return [...evaluations]
      .filter((evaluation: any) => {
        if (periodFilter !== 'all' && String(evaluation.batch_name || '') !== periodFilter) return false;
        if (classificationFilter !== 'all' && evaluation.classification !== classificationFilter) return false;

        if (!query) return true;

        const haystack = [
          evaluation.collaborator_name,
          evaluation.batch_name,
          evaluation.evaluator_name,
          evaluation.observations,
        ]
          .filter(Boolean)
          .join(' ')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a: any, b: any) =>
        Number(a.final_score || 0) - Number(b.final_score || 0) ||
        String(b.evaluation_date || b.created_at || '').localeCompare(String(a.evaluation_date || a.created_at || ''))
      );
  }, [evaluations, search, periodFilter, classificationFilter]);

  const clearFilters = () => {
    setSearch('');
    setPeriodFilter('all');
    setClassificationFilter('all');
  };

  const hasFilters = !!search || periodFilter !== 'all' || classificationFilter !== 'all';

  const exportFiltered = () => {
    if (!filtered.length) return;

    const rows = filtered.map((evaluation: any) => {
      const base: Record<string, any> = {
        Colaborador: evaluation.collaborator_name || '',
        Período: evaluation.batch_name || '',
        Data: new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString('pt-BR'),
        Avaliador: evaluation.evaluator_name || '',
        'Nota final': Number(evaluation.final_score || 0).toFixed(2),
        Classificação: PS_CLASSIFICATION_LABEL[evaluation.classification] || evaluation.classification || '',
      };

      for (const criterion of PS_CRITERIA) {
        base[criterion.label] = Number(evaluation[criterion.key] || 0) || '';
      }

      base.Observações = evaluation.observations || '';
      return base;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Avaliações');
    XLSX.writeFile(workbook, 'resultados-avaliacoes-gerais.xlsx');
  };

  return (
    <MainLayout>
      <PageHeader
        title="Resultados e Relatórios"
        description="Acompanhe avaliações gerais, médias consolidadas, critérios de desempenho e histórico periódico dos fiscais."
        actions={
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={!filtered.length}
            onClick={exportFiltered}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar XLSX
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-primary/20 bg-primary/[0.035]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avaliações gerais</p>
            <p className="mt-1 text-2xl font-bold">{summary.total}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{summary.people} colaborador(es) avaliados</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Média geral</p>
            <p className="mt-1 text-2xl font-bold">{summary.average ? summary.average.toFixed(2) : '—'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">escala consolidada de 1 a 5</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-500/20 bg-emerald-500/[0.025]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Excelente / Bom</p>
            <p className="mt-1 text-2xl font-bold text-emerald-500">{summary.excellent + summary.good}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {summary.excellent} excelente(s) · {summary.good} bom(ns)
            </p>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl ${summary.attention ? 'border-amber-500/25 bg-amber-500/[0.035]' : 'border-emerald-500/20 bg-emerald-500/[0.025]'}`}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Desempenho a revisar</p>
            <p className={`mt-1 text-2xl font-bold ${summary.attention ? 'text-amber-500' : 'text-emerald-500'}`}>
              {summary.attention}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">regular, insuficiente ou crítico</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary" />
                Desempenho consolidado
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Médias das avaliações gerais por critério.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {summary.weakestCriterion && (
                <Badge variant="outline" className="rounded-full border-amber-500/20 text-[9px] text-amber-500">
                  <TrendingDown className="mr-1 h-3 w-3" />
                  Menor média: {summary.weakestCriterion.label} · {summary.weakestCriterion.average.toFixed(2)}
                </Badge>
              )}
              {summary.strongestCriterion && (
                <Badge variant="outline" className="rounded-full border-emerald-500/20 text-[9px] text-emerald-500">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  Maior média: {summary.strongestCriterion.label} · {summary.strongestCriterion.average.toFixed(2)}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {summary.criteria.map((criterion) => (
              <div key={criterion.key} className="rounded-xl border border-border/60 bg-muted/[0.08] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[10px] font-semibold" title={criterion.label}>{criterion.label}</p>
                  <span className={`text-xs font-bold tabular-nums ${criterion.responses && criterion.average < 3 ? 'text-amber-500' : 'text-foreground'}`}>
                    {criterion.responses ? criterion.average.toFixed(2) : '—'}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${criterion.responses ? Math.min(100, (criterion.average / 5) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground">{criterion.responses} nota(s)</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Nova avaliação geral
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Registre uma avaliação periódica que não pertence a um evento específico.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Colaborador *</Label>
              <Select value={collaboratorId} onValueChange={setCollaboratorId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
                <SelectContent>
                  {collaborators
                    .filter((collaborator: any) => collaborator.active !== false)
                    .sort((a: any, b: any) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'pt-BR'))
                    .map((collaborator: any) => (
                      <SelectItem key={collaborator.id} value={collaborator.id}>{collaborator.full_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Período *</Label>
              <Input
                className="rounded-xl"
                placeholder="Ex.: 2026/2"
                value={period}
                onChange={event => setPeriod(event.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
              <PsCriteriaFields values={values} onChange={setValues} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Comentários</Label>
              <Textarea
                rows={3}
                value={comments}
                onChange={event => setComments(event.target.value)}
                placeholder="Observações complementares sobre o desempenho"
                className="rounded-xl"
              />
            </div>

            <Button
              className="w-full rounded-xl"
              onClick={() => void submit()}
              disabled={saveEval.isPending || !collaboratorId || !period.trim()}
            >
              {saveEval.isPending ? 'Registrando...' : 'Registrar avaliação'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-base">Histórico consolidado</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  As menores notas aparecem primeiro para facilitar a revisão.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit rounded-full">{filtered.length} registro(s)</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-2 xl:grid-cols-[minmax(260px,1fr)_170px_190px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar colaborador, avaliador ou observação..."
                  className="h-10 rounded-xl pl-10"
                />
              </div>

              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  {periodOptions.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Classificação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(PS_CLASSIFICATION_LABEL).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl"
                disabled={!hasFilters}
                onClick={clearFilters}
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            </div>

            {filtered.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 text-center">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground/45" />
                <p className="mt-3 text-sm font-medium">
                  {evaluations.length ? 'Nenhuma avaliação encontrada' : 'Nenhuma avaliação registrada'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {evaluations.length ? 'Ajuste os filtros para continuar.' : 'As avaliações periódicas aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <div className="max-h-[48rem] divide-y overflow-y-auto rounded-2xl border border-border/60">
                {filtered.map((evaluation: any) => (
                  <div
                    key={evaluation.id}
                    className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${['regular', 'insuficiente', 'critico'].includes(String(evaluation.classification || ''))
                      ? 'bg-amber-500/[0.018]'
                      : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{evaluation.collaborator_name}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {PS_CLASSIFICATION_LABEL[evaluation.classification] || evaluation.classification}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {evaluation.batch_name || 'Sem período'} · {new Date(evaluation.evaluation_date || evaluation.created_at).toLocaleDateString('pt-BR')} · {evaluation.evaluator_name || 'Sistema'}
                      </p>

                      {evaluation.observations && (
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {evaluation.observations}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Nota final</p>
                        <p className={`text-2xl font-bold tabular-nums ${Number(evaluation.final_score || 0) < 3 ? 'text-amber-500' : 'text-foreground'}`}>
                          {Number(evaluation.final_score || 0).toFixed(2)}
                        </p>
                      </div>
                      <Star className="h-4 w-4 text-primary" />
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
