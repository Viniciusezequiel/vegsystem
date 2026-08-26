import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  HeartPulse,
  PackageSearch,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSystemHealth, type SystemHealthStatus } from '@/hooks/useSystemHealth';

const statusConfig: Record<SystemHealthStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  healthy: { label: 'Saudável', icon: CheckCircle2, className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  warning: { label: 'Atenção', icon: AlertTriangle, className: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  critical: { label: 'Crítico', icon: XCircle, className: 'border-destructive/30 bg-destructive/10 text-destructive' },
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
      <Icon className="mr-1.5 h-3.5 w-3.5" /> {config.label}
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-48 rounded-2xl" />
      ))}
    </div>
  );
}

export default function SystemHealth() {
  const { data, isLoading, isError, isFetching, refetch } = useSystemHealth();

  if (isError) {
    return (
      <MainLayout>
        <div className="space-y-6" data-testid="system-health-page">
          <Header isFetching={isFetching} onRefresh={() => void refetch()} />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar as métricas</AlertTitle>
            <AlertDescription>Tente atualizar novamente. Nenhum dado técnico detalhado foi exibido.</AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6" data-testid="system-health-page">
        <Header
          generatedAt={data?.generated_at}
          status={data?.status}
          isFetching={isFetching}
          onRefresh={() => void refetch()}
        />

        {isLoading || !data ? <LoadingState /> : (
          <>
            {data.issues.length > 0 && (
              <Alert variant={data.status === 'critical' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Alertas técnicos</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {data.issues.map(issue => <li key={issue}>{issue}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard icon={Database} title="Banco de dados" description="Schema public e tamanho absoluto">
                <Metric label="Tamanho atual" value={data.database.size_pretty} />
                <Metric label="Tabelas public" value={data.database.public_tables} />
                <StatusBadge status="healthy" />
              </MetricCard>

              <MetricCard icon={HardDrive} title="Storage" description="Métricas agregadas dos buckets privados">
                {data.storage.map(bucket => (
                  <div key={bucket.bucket} className="rounded-lg border border-border/60 p-3">
                    <p className="font-medium">{bucket.bucket}</p>
                    <p className="text-sm text-muted-foreground">{bucket.objects} objetos · {bucket.size_pretty}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Mais recente: {formatDate(bucket.latest_object_at)}</p>
                  </div>
                ))}
              </MetricCard>

              <MetricCard icon={Clock3} title="Automações" description="Jobs obrigatórios do VEG System">
                <Metric label="Crons ativos" value={`${data.cron.filter(job => job.active).length} de 3`} />
                <StatusBadge status={data.cron.every(job => job.active) ? 'healthy' : 'critical'} />
              </MetricCard>

              <MetricCard icon={PackageSearch} title="Achados e Perdidos" description="Integridade dos itens e imagens">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Metric label="Atuais" value={data.lost_items.current} />
                  <Metric label="Disponíveis" value={data.lost_items.available} />
                  <Metric label="Entregues" value={data.lost_items.delivered} />
                  <Metric label="Arquivados" value={data.lost_items.archived} />
                </div>
                <div className={data.lost_items.base64_total > 0 ? 'rounded-lg bg-destructive/10 p-3 text-destructive' : 'rounded-lg bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400'}>
                  <p className="text-xs font-medium uppercase tracking-wide">Imagens Base64 detectadas</p>
                  <p className="text-2xl font-bold" data-testid="base64-count">{data.lost_items.base64_total}</p>
                  <p className="text-xs">Ativos: {data.lost_items.base64_active} · Arquivados: {data.lost_items.base64_archive}</p>
                </div>
              </MetricCard>

              <MetricCard icon={Users} title="Usuários" description="Somente informações agregadas">
                <Metric label="Profiles" value={data.users.profiles} />
                <Metric label="Usuários ativos" value={data.users.active_profiles} />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.users.by_role).map(([role, count]) => (
                    <Badge key={role} variant="secondary">{role}: {count}</Badge>
                  ))}
                </div>
              </MetricCard>
            </div>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Automações</CardTitle>
                <CardDescription>Última execução dos três jobs obrigatórios.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-3">
                {data.cron.map(job => (
                  <div key={job.jobname} className="rounded-xl border border-border/60 p-4" data-testid="cron-job">
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words font-medium">{job.jobname}</p>
                      <Badge variant={job.active ? 'secondary' : 'destructive'}>{job.active ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <dl className="mt-3 space-y-2 text-sm">
                      <Metric label="Schedule" value={job.schedule ?? 'Não configurado'} />
                      <Metric label="Última execução" value={formatDate(job.last_started_at)} />
                      <Metric label="Status" value={job.last_status ?? 'Sem registro'} />
                    </dl>
                    {job.recent_error && <p className="mt-3 text-sm text-destructive">{job.recent_error}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>Maiores tabelas</CardTitle>
                <CardDescription>As 10 maiores relações do schema public.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Tabela</TableHead><TableHead>Dados</TableHead><TableHead>Índices</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.largest_tables.slice(0, 10).map(table => (
                      <TableRow key={table.table}>
                        <TableCell className="font-medium">{table.table}</TableCell>
                        <TableCell>{table.data_pretty}</TableCell>
                        <TableCell>{table.index_pretty}</TableCell>
                        <TableCell>{table.total_pretty}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function Header({ generatedAt, status, isFetching, onRefresh }: { generatedAt?: string; status?: SystemHealthStatus; isFetching: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10"><HeartPulse className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Saúde do Sistema</h1>
          <p className="text-muted-foreground">Monitoramento técnico e integridade do VEG System.</p>
          <p className="mt-2 text-xs text-muted-foreground">Última atualização: {generatedAt ? formatDate(generatedAt) : 'Carregando...'}</p>
          {status && <div className="mt-2"><StatusBadge status={status} /></div>}
        </div>
      </div>
      <Button variant="outline" onClick={onRefresh} disabled={isFetching}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar dados
      </Button>
    </div>
  );
}

function MetricCard({ icon: Icon, title, description, children }: { icon: typeof Database; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-semibold">{value}</span></div>;
}
