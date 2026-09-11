import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, CheckCircle2, FileSpreadsheet, Loader2, MapPinned, Plus, School, Sparkles } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PsV2LocationDialog } from '@/components/processo-seletivo-v2/PsV2LocationDialog';
import { PsV2StructureImportDialog } from '@/components/processo-seletivo-v2/PsV2StructureImportDialog';
import { PsV2StructureManager } from '@/components/processo-seletivo-v2/PsV2StructureManager';
import { usePsV2LegacyStructure, usePsV2Locations } from '@/hooks/useProcessoSeletivoV2';
import { PS_V2_BASE_PATH, PS_V2_STRUCTURE_LEVELS } from '@/lib/psV2Architecture';
import { importPsV2Structure, legacyCampusToV2Rows } from '@/lib/psV2StructureService';

export default function PsV2Locations() {
  const qc = useQueryClient();
  const locationsQuery = usePsV2Locations();
  const legacyQuery = usePsV2LegacyStructure();
  const locations = locationsQuery.data?.locations || [];
  const schemaReady = locationsQuery.data?.schemaReady !== false;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [migratingCampus, setMigratingCampus] = useState<string | null>(null);
  const selected = locations.find((item: any) => item.id === selectedId) || null;

  const floorsByCampus = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const floor of legacyQuery.data?.floors || []) {
      const key = String((floor as any).campus_id || '');
      map.set(key, [...(map.get(key) || []), floor]);
    }
    return map;
  }, [legacyQuery.data?.floors]);

  const openNew = () => { setEditingLocation(null); setLocationDialog(true); };
  const openEdit = (location: any) => { setEditingLocation(location); setLocationDialog(true); };
  const migrateLegacy = async (campus: any) => {
    const floors = floorsByCampus.get(String(campus.id)) || [];
    setMigratingCampus(campus.id);
    try {
      await importPsV2Structure(legacyCampusToV2Rows(campus, floors), 'legacy');
      await qc.invalidateQueries({ queryKey: ['ps-v2'] });
      toast.success(`${campus.name} foi trazido para a estrutura V2.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível migrar o local.'); }
    finally { setMigratingCampus(null); }
  };

  return <MainLayout>
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><Button asChild variant="ghost" size="icon" className="mt-0.5"><Link to={PS_V2_BASE_PATH}><ArrowLeft className="h-4 w-4" /></Link></Button><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">Processo Seletivo 2</Badge><Badge variant="secondary">Estrutura física</Badge></div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Locais, prédios e ambientes</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Cadastre a estrutura uma vez. Depois cada evento escolhe o que vai utilizar e define necessidades de equipe por prédio, andar, área ou sala.</p></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImportDialog(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Importar planilha</Button><Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo local</Button></div>
    </div>

    {!schemaReady && <Card className="mb-5 rounded-2xl border-amber-500/25 bg-amber-500/[0.05]"><CardContent className="flex items-start gap-3 p-4"><Sparkles className="mt-0.5 h-5 w-5 text-amber-500" /><div><p className="text-sm font-medium">Backend do V2 preparado, mas ainda não ativado</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A migration nova está isolada na branch. A leitura do módulo antigo continua normal e nenhuma tabela atual foi alterada.</p></div></CardContent></Card>}

    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{PS_V2_STRUCTURE_LEVELS.map((level, index) => { const Icon = level.icon; return <div key={level.key} className="rounded-2xl border border-border/60 bg-card/65 p-4"><div className="flex items-center justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><span className="text-[10px] font-semibold text-muted-foreground">0{index + 1}</span></div><p className="mt-3 text-sm font-semibold">{level.label}</p><p className="mt-1 text-xs text-muted-foreground">Ex.: {level.example}</p></div>; })}</section>

    <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit rounded-2xl border-border/60 bg-card/65"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MapPinned className="h-4 w-4 text-primary" />Locais do V2</CardTitle><CardDescription>Selecione um local para abrir sua estrutura completa.</CardDescription></CardHeader><CardContent className="space-y-2">
        {locationsQuery.isLoading && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando...</div>}
        {!locationsQuery.isLoading && !locations.length && <div className="rounded-xl border border-dashed p-6 text-center"><p className="text-sm font-medium">Nenhum local V2 cadastrado</p><p className="mt-1 text-xs text-muted-foreground">Crie manualmente ou importe sua planilha atual.</p></div>}
        {locations.map((location: any) => <button key={location.id} type="button" onClick={() => setSelectedId(location.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === location.id ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/60 bg-muted/10 hover:border-primary/25'}`}><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{location.name}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{location.city || location.address_line || 'Endereço não informado'}</p></div>{location.source === 'legacy' ? <Badge variant="secondary">Migrado</Badge> : <CheckCircle2 className="h-4 w-4 text-primary" />}</div></button>)}
      </CardContent></Card>
      <div>{selected ? <PsV2StructureManager location={selected} onEditLocation={() => openEdit(selected)} /> : <Card className="rounded-2xl border-dashed bg-card/40"><CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center"><Building2 className="h-9 w-9 text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">Selecione um local</p><p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">Aqui você irá destrinchar prédio → andar → áreas de corredor/banheiro/coordenação → ambientes e salas.</p></CardContent></Card>}</div>
    </div>

    <Card className="mt-5 rounded-2xl border-border/60 bg-card/65"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><School className="h-4 w-4 text-primary" />Estrutura existente no módulo atual</CardTitle><CardDescription>O módulo antigo permanece intacto. Você pode trazer um campus para o V2 quando quiser, sem apagar a origem.</CardDescription></CardHeader><CardContent className="grid gap-3 lg:grid-cols-2">
      {(legacyQuery.data?.campuses || []).map((campus: any) => { const floors = floorsByCampus.get(String(campus.id)) || []; const roomCount = floors.reduce((total, floor) => total + (Array.isArray(floor.rooms) ? floor.rooms.length : 0), 0); return <div key={campus.id} className="rounded-xl border border-border/60 bg-muted/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{campus.name}</p><p className="mt-1 text-xs text-muted-foreground">{floors.length} andares · {roomCount} salas</p></div><Button variant="outline" size="sm" disabled={!schemaReady || migratingCampus === campus.id} onClick={() => migrateLegacy(campus)}>{migratingCampus === campus.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Trazer para V2</Button></div></div>; })}
    </CardContent></Card>

    <PsV2LocationDialog open={locationDialog} onOpenChange={setLocationDialog} location={editingLocation} onSaved={(saved) => setSelectedId(saved.id)} />
    <PsV2StructureImportDialog open={importDialog} onOpenChange={setImportDialog} schemaReady={schemaReady} />
  </MainLayout>;
}
