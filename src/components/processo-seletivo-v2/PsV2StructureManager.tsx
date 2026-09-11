import { useMemo, useState } from 'react';
import { Building2, DoorOpen, Edit3, Layers3, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PsV2NodeDialog } from '@/components/processo-seletivo-v2/PsV2NodeDialog';
import { usePsV2LocationStructure, usePsV2StructureMutations } from '@/hooks/useProcessoSeletivoV2';

type Kind = 'building' | 'floor' | 'area' | 'environment';
type DialogState = { kind: Kind; parentId: string; row?: any | null; floorAreas?: any[] } | null;
type Props = { location: any; onEditLocation: () => void };

export function PsV2StructureManager({ location, onEditLocation }: Props) {
  const structure = usePsV2LocationStructure(location.id);
  const { removeNode } = usePsV2StructureMutations();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [remove, setRemove] = useState<{ table: string; id: string; label: string } | null>(null);
  const data = structure.data;

  const grouped = useMemo(() => ({
    floorsByBuilding: new Map((data?.buildings || []).map((building: any) => [building.id, (data?.floors || []).filter((floor: any) => floor.building_id === building.id)])),
    areasByFloor: new Map((data?.floors || []).map((floor: any) => [floor.id, (data?.areas || []).filter((area: any) => area.floor_id === floor.id)])),
    environmentsByFloor: new Map((data?.floors || []).map((floor: any) => [floor.id, (data?.environments || []).filter((environment: any) => environment.floor_id === floor.id)])),
  }), [data]);

  const doRemove = async () => {
    if (!remove) return;
    await removeNode.mutateAsync({ table: remove.table, id: remove.id });
    setRemove(null);
  };

  if (structure.isLoading) return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando estrutura...</div>;

  return <>
    <Card className="rounded-2xl border-primary/20 bg-card/70">
      <CardHeader className="pb-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />{location.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{[location.address_line, location.city, location.state].filter(Boolean).join(' · ') || 'Endereço ainda não informado'}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={onEditLocation}><Edit3 className="mr-2 h-4 w-4" />Editar local</Button><Button size="sm" onClick={() => setDialog({ kind: 'building', parentId: location.id })}><Plus className="mr-2 h-4 w-4" />Prédio</Button></div></div></CardHeader>
      <CardContent className="space-y-4">
        {!data?.buildings?.length && <div className="rounded-xl border border-dashed p-7 text-center"><Building2 className="mx-auto h-6 w-6 text-muted-foreground/50" /><p className="mt-2 text-sm font-medium">Nenhum prédio cadastrado</p><p className="mt-1 text-xs text-muted-foreground">Comece pelo prédio e depois adicione andares, áreas e ambientes.</p></div>}
        {(data?.buildings || []).map((building: any) => {
          const floors = (grouped.floorsByBuilding.get(building.id) || []) as any[];
          return <div key={building.id} className="rounded-2xl border border-border/60 bg-muted/[0.07] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{building.name}</p><p className="text-[11px] text-muted-foreground">{floors.length} andar(es)</p></div></div><div className="flex flex-wrap gap-1.5"><Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'building', parentId: location.id, row: building })}>Editar</Button><Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'floor', parentId: building.id })}><Plus className="mr-1 h-3.5 w-3.5" />Andar</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setRemove({ table: 'ps_v2_buildings', id: building.id, label: building.name })}><Trash2 className="h-4 w-4" /></Button></div></div>
            <div className="mt-3 space-y-3">{floors.map((floor: any) => {
              const areas = (grouped.areasByFloor.get(floor.id) || []) as any[];
              const environments = (grouped.environmentsByFloor.get(floor.id) || []) as any[];
              return <div key={floor.id} className="rounded-xl border border-border/50 bg-background/35 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{floor.name}</span><Badge variant="secondary">{environments.length} ambientes</Badge></div><div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'floor', parentId: building.id, row: floor })}>Editar</Button><Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'area', parentId: floor.id })}><Plus className="mr-1 h-3.5 w-3.5" />Área</Button><Button variant="outline" size="sm" onClick={() => setDialog({ kind: 'environment', parentId: floor.id, floorAreas: areas })}><Plus className="mr-1 h-3.5 w-3.5" />Ambiente</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setRemove({ table: 'ps_v2_floors', id: floor.id, label: floor.name })}><Trash2 className="h-4 w-4" /></Button></div></div>
                {!!areas.length && <div className="mt-3 flex flex-wrap gap-2">{areas.map((area: any) => <button key={area.id} type="button" onClick={() => setDialog({ kind: 'area', parentId: floor.id, row: area })} className="rounded-lg border border-border/50 bg-muted/10 px-2.5 py-1.5 text-left text-xs transition hover:border-primary/30"><span className="font-medium">{area.name}</span><span className="ml-1 text-muted-foreground">· {area.area_type}</span></button>)}</div>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{environments.map((environment: any) => <button key={environment.id} type="button" onClick={() => setDialog({ kind: 'environment', parentId: floor.id, row: environment, floorAreas: areas })} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-2.5 text-left transition hover:border-primary/30"><div className="flex min-w-0 items-center gap-2"><DoorOpen className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-medium">{environment.name}</p><p className="text-[10px] text-muted-foreground">{environment.environment_type}{environment.capacity != null ? ` · cap. ${environment.capacity}` : ''}</p></div></div><Edit3 className="h-3.5 w-3.5 text-muted-foreground" /></button>)}</div>
              </div>;
            })}</div>
          </div>;
        })}
      </CardContent>
    </Card>

    {dialog && <PsV2NodeDialog open={!!dialog} onOpenChange={open => !open && setDialog(null)} kind={dialog.kind} parentId={dialog.parentId} row={dialog.row} floorAreas={dialog.floorAreas} />}
    <AlertDialog open={!!remove} onOpenChange={open => !open && setRemove(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir “{remove?.label}”?</AlertDialogTitle><AlertDialogDescription>Itens internos vinculados também poderão ser removidos. Esta ação não deve ser usada se a estrutura já estiver associada a um evento em produção.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={doRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
