// PÁGINA TEMPORÁRIA — operação da migração do backend. Remover após a virada.
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, Database, HardDrive, Loader2, Users } from 'lucide-react';

type TableResult = { table: string; copiadas?: number; origem?: number | null; destino?: number | null; ok?: boolean; erro?: string | null };

export default function MigracaoBackend() {
  const [busy, setBusy] = useState<string | null>(null);
  const [tableResults, setTableResults] = useState<TableResult[] | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) => setLog((prev) => [`${new Date().toLocaleTimeString('pt-BR')} — ${line}`, ...prev].slice(0, 200));

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
      const falhas = data.results.filter((r) => r.erro || r.ok === false).length;
      addLog(`${action === 'copy' ? 'Cópia' : 'Conferência'} concluída — ${data.results.length} tabelas, ${falhas} com pendência.`);
      toast({ title: action === 'copy' ? 'Cópia concluída' : 'Conferência concluída', description: `${falhas} tabela(s) com pendência.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`ERRO: ${msg}`);
      toast({ title: 'Falhou', description: msg, variant: 'destructive' });
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
          const data: { total: number; processados: number; copiados: number; falhas: string[]; proximo_start: number | null } =
            await invoke('export-storage-migracao', { bucket, start, batch: 50 });
          addLog(`${bucket}: ${data.processados}/${data.total} processados (${data.copiados} nesta leva, ${data.falhas.length} falhas)`);
          data.falhas.slice(0, 5).forEach((f) => addLog(`  falha ${bucket}: ${f}`));
          start = data.proximo_start;
        }
      }
      toast({ title: 'Arquivos copiados' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`ERRO storage: ${msg}`);
      toast({ title: 'Falhou', description: msg, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runUsers = async () => {
    setBusy('users');
    try {
      const data = await invoke<{ total_origem: number; criados: number; existentes: number; falhas: string[] }>('export-users-migracao', {});
      addLog(`Usuários: ${data.criados} criados, ${data.existentes} já existiam, ${data.falhas.length} falhas (de ${data.total_origem}).`);
      data.falhas.slice(0, 10).forEach((f) => addLog(`  falha usuário: ${f}`));
      toast({ title: 'Usuários migrados', description: 'Senhas não migram — usar "esqueci minha senha" no novo backend.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      addLog(`ERRO usuários: ${msg}`);
      toast({ title: 'Falhou', description: msg, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const steps = [
    { key: 'users', title: '1. Usuários', desc: 'Recria as contas no destino com o mesmo identificador. Rode antes dos dados.', icon: Users, run: runUsers },
    { key: 'copy', title: '2. Dados das tabelas', desc: 'Copia as 59 tabelas na ordem de dependência, em páginas.', icon: Database, run: () => runTables('copy') },
    { key: 'storage', title: '3. Arquivos', desc: 'Copia os buckets lost-items e task-attachments.', icon: HardDrive, run: runStorage },
    { key: 'verify', title: '4. Conferência', desc: 'Compara a contagem de linhas tabela a tabela.', icon: Database, run: () => runTables('verify') },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Migração do backend</h1>
          <p className="text-muted-foreground">Copia banco, arquivos e usuários para o seu projeto Supabase externo.</p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Antes de rodar</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>1. Aplique <code>migracao/dump/01_estrutura.sql</code> no SQL Editor do projeto destino.</p>
            <p>2. Crie no destino os buckets privados <code>lost-items</code> e <code>task-attachments</code>.</p>
            <p>3. Cadastre o segredo <code>DST_SERVICE_KEY</code> (service role do destino) no backend.</p>
            <p>As senhas dos usuários não migram: cada pessoa usa "esqueci minha senha" no primeiro acesso.</p>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <Card key={s.key} className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><s.icon className="h-4 w-4 text-primary" />{s.title}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={s.run} disabled={busy !== null}>
                  {busy === s.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Executar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {tableResults && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Resultado por tabela</CardTitle></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tableResults.map((r) => (
                <div key={r.table} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span className="truncate">{r.table}</span>
                  {r.erro ? (
                    <Badge variant="destructive" title={r.erro}>erro</Badge>
                  ) : r.ok !== undefined ? (
                    <Badge variant={r.ok ? 'secondary' : 'destructive'}>{r.origem ?? '?'} / {r.destino ?? '?'}</Badge>
                  ) : (
                    <Badge variant="secondary">{r.copiadas ?? 0}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {log.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Log</CardTitle></CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{log.join('\n')}</pre>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
