import type { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  PackageSearch,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSystemHealth, type SystemHealthStatus } from '@/hooks/useSystemHealth';

const statusConfig: Record<SystemHealthStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  healthy: {
    label: 'Saudável',
    icon: CheckCircle2,
    className: 'border-success/30 bg-success/10 text-success',
  },
  warning: {
    label: 'Atenção',
    icon: AlertTriangle,
    className: 'border-warning/30 bg-warning/10 text-warning',
  },
  critical: {
    label: 'Crítico',
    icon: XCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

function formatDate(value: string | null) {
  if (!value) return 'Sem execução registrada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function StatusBadge({ status }: { status: SystemHealthStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="mr-1.5 h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}

export default function SystemHealth() {
  const { data, isLoading, isError, isFetching, refetch } = useSystemHealth();

  return (
    <MainLayout>
      <div data-testid="system-health-page">
        <PageHeader
          title="Saúde do Sistema"
          description="Acompanhe banco, storage, automações e indicadores de integridade do VegSystem."
          actions={
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar dados
            </Button>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Última atualização: {data?.generated_at ? formatDate(data.generated_at) : 'Carregando...'}</span>
          {data?.status && <StatusBadge status={data.status} />}
        </div>

        {isError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar as métricas</AlertTitle>
            <AlertDescription>Tente atualizar novamente. Nenhum dado técnico detalhado foi exibido.</AlertDescription>
          </Alert>
        ) : isLoading || !data ? (
          <LoadingState />
        ) : (
          <div className="space-y-4">
            {data.issues.length > 0 && (
              <Alert variant={data.status === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Alertas técnicos</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {data.issues.map(issue => <li key={issue}>{issue}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard icon={Database} title="Banco de dados" description="Schema público e ocupação atual">
                <Metric label="Tamanho atual" value={data.database.size_pretty} />
                <Metric label="Tabelas public" value={data.database.public_tables} />
                <StatusBadge status="healthy" />
              </MetricCard>

              <MetricCard icon={HardDrive} title="Storage" description="Objetos e volume dos buckets privados">
                <div className="space-y-2">
                  {data.storage.map(bucket => (
                    <div key={bucket.bucket} className="rounded-lg border border-border/60 bg-muted/15 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium">{bucket.bucket}</p>
                        <span className="text-xs text-muted-foreground">{bucket.size_pretty}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{bucket.objects} objetos</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">Mais recente: {formatDate(bucket.latest_object_at)}</p>
                    </div>
                  ))}
                </div>
              </MetricCard>

              <MetricCard icon={Clock3} title="Automações" description="Jobs obrigatórios do sistema">
                <Metric label="Crons ativos" value={`${data.cron.filter(job => job.active).length} de 3`} />
                <StatusBadge status={data.cron.every(job => job.active) ? 'healthy' : 'critical'} />
              </MetricCard>

              <MetricCard icon={PackageSearch} title="Achados e Perdidos" description="Itens e integridade das imagens">
                <div className="grid grid-cols-2 gap-2">
                  <CompactMetric label="Atuais" value={data.lost_items.current} />
                  <CompactMetric label="Disponíveis" value={data.lost_items.available} />
                  <CompactMetric label="Entregues" value={data.lost_items.delivered} />
                  <CompactMetric label="Arquivados" value={data.lost_items.archived} />
                </div>
                <div className={`rounded-lg border p-3 ${data.lost_items.base64_total > 0 ? 'border-destructive/20 bg-destructive/5' : 'border-success/20 bg-success/5'}`}>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Imagens Base64 detectadas</p>
                  <p className={`mt-1 text-2xl font-semibold tabular-nums ${data.lost_items.base64_total > 0 ? 'text-destructive' : 'text-success'}`} data-testid="base64-count">
                    {data.lost_items.base64_total}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Ativos: {data.lost_items.base64_active} · Arquivados: {data.lost_items.base64_archive}</p>
                </div>
              </MetricCard>

              <MetricCard icon={Users} title="Usuários" description="Visão agregada dos perfis internos">
                <Metric label="Profiles" value={data.users.profiles} />
                <Metric label="Usuários ativos" value={data.users.active_profiles} />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(data.users.by_role).map(([role, count]) => (
                    <Badge key={role} variant="secondary" className="text-[10px]">{role}: {count}</Badge>
                  ))}
                </div>
              </MetricCard>
            </div>

            <Card className="border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Automações</CardTitle>
                <CardDescription>Estado e última execução dos três jobs obrigatórios.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-3">
                {data.cron.map(job => (
                  <div key={job.jobname} className="rounded-xl border border-border/60 bg-muted/10 p-4" data-testid="cron-job">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words text-sm font-medium">{job.jobname}</p>
                      <Badge variant={job.active ? 'secondary' : 'destructive'}>{job.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <Metric label="Schedule" value={job.schedule ?? 'Não configurado'} />
                      <Metric label="Última execução" value={formatDate(job.last_started_at)} />
                      <Metric label="Status" value={job.last_status ?? 'Sem registro'} />
                    </dl>
                    {job.recent_error && <p className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">{job.recent_error}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/60 bg-card/65 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Maiores tabelas</CardTitle>
                <CardDescription>As 10 maiores relações do schema public.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/25 hover:bg-muted/25">
                      <TableHead className="pl-5">Tabela</TableHead>
                      <TableHead>Dados</TableHead>
                      <TableHead>Índices</TableHead>
                      <TableHead className="pr-5">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.largest_tables.slice(0, 10).map(table => (
                      <TableRow key={table.table}>
                        <TableCell className="pl-5 font-mono text-xs font-medium">{table.table}</TableCell>
                        <TableCell>{table.data_pretty}</TableCell>
                        <TableCell>{table.index_pretty}</TableCell>
                        <TableCell className="pr-5 font-medium">{table.total_pretty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function MetricCard({ icon: Icon, title, description, children }: { icon: typeof Database; title: string; description: string; children: ReactNode }) {
  return (
    <Card className="border-border/60 bg-card/65 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <CardTitle className="pt-1 text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words text-right font-semibold">{value}</span>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
