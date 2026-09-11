import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Layers3,
  MapPinned,
  Plus,
  Route,
  School,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { PS_V2_BASE_PATH, PS_V2_STRUCTURE_LEVELS } from '@/lib/psV2Architecture';

function useLegacyPsStructure() {
  return useQuery({
    queryKey: ['ps-v2', 'legacy-structure'],
    queryFn: async () => {
      const [campusesResult, floorsResult] = await Promise.all([
        supabase.from('ps_campuses').select('*').order('name'),
        supabase.from('ps_campus_floors').select('*').order('name'),
      ]);
      if (campusesResult.error) throw campusesResult.error;
      if (floorsResult.error) throw floorsResult.error;
      return { campuses: campusesResult.data || [], floors: floorsResult.data || [] };
    },
  });
}

export default function PsV2Locations() {
  const { data, isLoading, error } = useLegacyPsStructure();
  const [mode, setMode] = useState<'manual' | 'import' | null>(null);

  const floorsByCampus = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const floor of data?.floors || []) {
      const campusId = String((floor as any).campus_id || '');
      const current = map.get(campusId) || [];
      current.push(floor);
      map.set(campusId, current);
    }
    return map;
  }, [data?.floors]);

  return (
    <MainLayout>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="mt-0.5"><Link to={PS_V2_BASE_PATH}><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">Processo Seletivo 2</Badge><Badge variant="secondary">Fundação</Badge></div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Locais e estrutura física</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Cadastre a estrutura uma vez e reutilize em vários eventos. As necessidades de fiscais poderão existir na sala, no corredor, no andar, no prédio ou no evento inteiro.</p>
          </div>
        </div>
      </div>

      <section className="grid gap-3 lg:grid-cols-2">
        <button type="button" onClick={() => setMode('manual')} className={`group rounded-2xl border p-5 text-left transition ${mode === 'manual' ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/60 bg-card/65 hover:border-primary/25 hover:bg-card/85'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus className="h-5 w-5" /></div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Criar manualmente</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Monte local, prédio, andares, corredores e ambientes pela interface. Ideal para estruturas novas ou ajustes pontuais.</p>
        </button>

        <button type="button" onClick={() => setMode('import')} className={`group rounded-2xl border p-5 text-left transition ${mode === 'import' ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/60 bg-card/65 hover:border-primary/25 hover:bg-card/85'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Importar planilha</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Mantenha o fluxo de planilha já utilizado, com prévia, validação de inconsistências e revisão antes de gravar.</p>
        </button>
      </section>

      {mode && (
        <Card className="mt-4 rounded-2xl border-primary/20 bg-primary/[0.035]">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">{mode === 'manual' ? 'Fluxo manual selecionado' : 'Fluxo de importação selecionado'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Nesta fundação ainda não há gravação nova no banco. O próximo passo será ligar este fluxo ao modelo de dados isolado e implementar salvar, validar, cancelar e alterações não salvas.</p></div></div>
            <Button variant="outline" size="sm" onClick={() => setMode(null)}>Fechar prévia</Button>
          </CardContent>
        </Card>
      )}

      <section className="mt-5">
        <div className="mb-3"><h2 className="text-base font-semibold">Hierarquia que o V2 vai utilizar</h2><p className="mt-0.5 text-xs text-muted-foreground">A estrutura não termina na sala; qualquer nível pode receber uma necessidade própria de equipe.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {PS_V2_STRUCTURE_LEVELS.map((level, index) => {
            const Icon = level.icon;
            return (
              <div key={level.key} className="relative rounded-2xl border border-border/60 bg-card/65 p-4">
                <div className="flex items-center justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><span className="text-[10px] font-semibold text-muted-foreground">0{index + 1}</span></div>
                <p className="mt-3 text-sm font-semibold">{level.label}</p><p className="mt-1 text-xs text-muted-foreground">Ex.: {level.example}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-2xl border-border/60 bg-card/65">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-4 w-4 text-primary" />Estruturas já existentes</CardTitle><CardDescription>Leitura da base atual para não perder o que já foi cadastrado no Processo Seletivo.</CardDescription></CardHeader>
          <CardContent>
            {isLoading && <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">Carregando estrutura atual...</div>}
            {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível ler a estrutura atual.</div>}
            {!isLoading && !error && (
              <div className="space-y-3">
                {(data?.campuses || []).map((campus: any) => {
                  const floors = floorsByCampus.get(String(campus.id)) || [];
                  const roomCount = floors.reduce((total, floor: any) => total + (Array.isArray(floor.rooms) ? floor.rooms.length : 0), 0);
                  return (
                    <div key={campus.id} className="rounded-xl border border-border/60 bg-muted/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><School className="h-5 w-5" /></div><div><p className="text-sm font-semibold">{campus.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Base atual · pronta para migração controlada ao novo modelo</p></div></div>
                        <div className="flex gap-2"><Badge variant="secondary">{floors.length} andares</Badge><Badge variant="outline">{roomCount} salas</Badge></div>
                      </div>
                      {!!floors.length && <div className="mt-3 flex flex-wrap gap-2">{floors.map((floor: any) => <span key={floor.id} className="rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5 text-xs text-muted-foreground">{floor.name} · {Array.isArray(floor.rooms) ? floor.rooms.length : 0} ambientes</span>)}</div>}
                    </div>
                  );
                })}
                {!data?.campuses?.length && <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">Nenhum local encontrado na estrutura atual.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="rounded-2xl border-border/60 bg-card/65">
            <CardHeader className="pb-3"><CardTitle className="text-base">Exemplo de necessidade</CardTitle><CardDescription>O mesmo andar pode ter necessidades diferentes das salas.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><div className="flex items-center gap-2 font-medium"><Layers3 className="h-4 w-4 text-primary" />1º andar</div><p className="mt-2 text-xs text-muted-foreground">1 coordenador · 1 subcoordenador · 2 itinerantes</p></div>
              <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><div className="flex items-center gap-2 font-medium"><Route className="h-4 w-4 text-primary" />Sala 101</div><p className="mt-2 text-xs text-muted-foreground">1 líder de sala · 2 fiscais de sala</p></div>
              <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" />Área sanitária</div><p className="mt-2 text-xs text-muted-foreground">Funções específicas sujeitas à matriz de elegibilidade.</p></div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-amber-500/20 bg-amber-500/[0.05]">
            <CardContent className="p-4"><p className="text-sm font-medium">Regra de segurança do V2</p><p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">Nenhuma alocação automática será publicada diretamente. O sistema gera uma proposta, explica os critérios usados e exige revisão antes da publicação.</p></CardContent>
          </Card>
        </aside>
      </div>
    </MainLayout>
  );
}
