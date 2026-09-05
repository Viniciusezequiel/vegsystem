// PÁGINA TEMPORÁRIA — operação da migração do backend. Remover após a virada.
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  TerminalSquare,
  Users,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type TableResult = {
  table: string;
  copiadas?: number;
  origem?: number | null;
  destino?: number | null;
  ok?: boolean;
  erro?: string | null;
};

export default function MigracaoBackend() {
  const [busy, setBusy] = useState<string | null>(null);
  const [tableResults, setTableResults] = useState<TableResult[] | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) => {
    setLog(previous => [`${new Date().toLocaleTimeString('pt-BR')} — ${line}`, ...previous].slice(0, 200));
  };

  const invoke = async <T,>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as T;
  };

  const runTables = async (action: 'copy' | 'verify') => {
    setBusy(action);
    try {
      const data = await invoke<{ results: TableResult[] }>('export-migracao', { action });
      setTableResults(data.results);
      const failures = data.results.filter(result => result.erro || result.ok === false).length;
      addLog(`${action === 'copy' ? 'Cópia' : 'Conferência'} concluída — ${data.results.length} tabelas, ${failures} com pendência.`);
      toast({
        title: action === 'copy' ? 'Cópia concluída' : 'Conferência concluída',
        description: `${failures} tabela(s) com pendência.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`ERRO: ${message}`);
      toast({ title: 'Falhou', description: message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runStorage = async () => {
    setBusy('storage');
    try {
      for (const bucket of ['lost-items', 'task-attachments']) {
        let start: number | null = 0;
        while (start !== null) {
          const data: {
            total: number;
            processados: number;
            copiados: number;
            falhas: string[];
            proximo_start: number | null;
          } = await invoke('export-storage-migracao', { bucket, start, batch: 50 });

          addLog(`${bucket}: ${data.processados}/${data.total} processados (${data.copiados} nesta leva, ${data.falhas.length} falhas)`);
          data.falhas.slice(0, 5).forEach(failure => addLog(`  falha ${bucket}: ${failure}`));
          start = data.proximo_start;
        }
      }
      toast({ title: 'Arquivos copiados' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`ERRO storage: ${message}`);
      toast({ title: 'Falhou', description: message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runUsers = async () => {
    setBusy('users');
    try {
      const data = await invoke<{ total_origem: number; criados: number; existentes: number; falhas: string[] }>('export-users-migracao', {});
      addLog(`Usuários: ${data.criados} criados, ${data.existentes} já existiam, ${data.falhas.length} falhas (de ${data.total_origem}).`);
      data.falhas.slice(0, 10).forEach(failure => addLog(`  falha usuário: ${failure}`));
      toast({
        title: 'Usuários migrados',
        description: 'Senhas não migram — usar "esqueci minha senha" no novo backend.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`ERRO usuários: ${message}`);
      toast({ title: 'Falhou', description: message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    {
      key: 'users',
      title: 'Usuários',
      number: '01',
      desc: 'Recria as contas no destino com o mesmo identificador. Execute antes dos dados.',
      icon: Users,
      run: runUsers,
    },
    {
      key: 'copy',
      title: 'Dados das tabelas',
      number: '02',
      desc: 'Copia as tabelas na ordem de dependência, em páginas.',
      icon: Database,
      run: () => runTables('copy'),
    },
    {
      key: 'storage',
      title: 'Arquivos',
      number: '03',
      desc: 'Copia os buckets lost-items e task-attachments.',
      icon: HardDrive,
      run: runStorage,
    },
    {
      key: 'verify',
      title: 'Conferência',
      number: '04',
      desc: 'Compara a contagem de linhas tabela a tabela.',
      icon: CheckCircle2,
      run: () => runTables('verify'),
    },
  ];

  const pendingTables = tableResults?.filter(result => result.erro || result.ok === false).length ?? 0;

  return (
    <MainLayout>
      <PageHeader
        title="Migração do backend"
        description="Console temporário para copiar usuários, banco e arquivos para o projeto Supabase de destino."
      />

      <Alert className="mb-4 border-warning/25 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Pré-requisitos antes de executar</AlertTitle>
        <AlertDescription>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
            <li>Aplique <code className="rounded bg-muted px-1 py-0.5">migracao/dump/01_estrutura.sql</code> no SQL Editor do destino.</li>
            <li>Crie os buckets privados <code className="rounded bg-muted px-1 py-0.5">lost-items</code> e <code className="rounded bg-muted px-1 py-0.5">task-attachments</code>.</li>
            <li>Cadastre o segredo <code className="rounded bg-muted px-1 py-0.5">DST_SERVICE_KEY</code> no backend.</li>
            <li>As senhas não migram; os usuários deverão redefini-las no primeiro acesso.</li>
          </ol>
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        {steps.map(step => {
          const Icon = step.icon;
          const isRunning = busy === step.key;
          const isLocked = busy !== null && !isRunning;

          return (
            <Card key={step.key} className={`border-border/60 bg-card/65 shadow-sm ${isRunning ? 'ring-1 ring-primary/30' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{step.number}</span>
                        <CardTitle className="text-base">{step.title}</CardTitle>
                      </div>
                      <CardDescription className="mt-1 text-xs leading-relaxed">{step.desc}</CardDescription>
                    </div>
                  </div>
                  {isRunning && <Badge variant="secondary">Executando</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <Button size="sm" onClick={step.run} disabled={busy !== null}>
                  {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isRunning ? 'Processando...' : 'Executar etapa'}
                </Button>
                {isLocked && <p className="mt-2 text-[11px] text-muted-foreground">Aguarde a etapa em execução terminar.</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {tableResults && (
        <Card className="mt-4 border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base">Resultado por tabela</CardTitle>
              <CardDescription>{tableResults.length} tabelas processadas nesta execução.</CardDescription>
            </div>
            <Badge variant={pendingTables > 0 ? 'destructive' : 'secondary'}>
              {pendingTables > 0 ? `${pendingTables} pendência(s)` : 'Sem pendências'}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tableResults.map(result => (
              <div key={result.table} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm">
                <span className="truncate font-mono text-xs">{result.table}</span>
                {result.erro ? (
                  <Badge variant="destructive" title={result.erro}>erro</Badge>
                ) : result.ok !== undefined ? (
                  <Badge variant={result.ok ? 'secondary' : 'destructive'}>{result.origem ?? '?'} / {result.destino ?? '?'}</Badge>
                ) : (
                  <Badge variant="secondary">{result.copiadas ?? 0}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {log.length > 0 && (
        <Card className="mt-4 overflow-hidden border-border/60 bg-card/65 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <TerminalSquare className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Log de execução</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{log.join('\n')}</pre>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
