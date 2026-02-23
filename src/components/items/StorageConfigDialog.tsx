import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2, Save, Loader2, Package } from 'lucide-react';
import {
  useStorageConfig,
  useUpdateStorageConfig,
  StorageConfigData,
  ShelfConfig,
} from '@/hooks/useStorageConfig';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const allCampuses: CampusEnum[] = [
  'Campus I',
  'Campus II',
  'Campus IV',
  'Campus HUCM Adm',
];

interface StorageConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const genId = () => Math.random().toString(36).substring(2, 9);

export function StorageConfigDialog({
  open,
  onOpenChange,
}: StorageConfigDialogProps) {
  const { data: config, isLoading } = useStorageConfig();
  const updateConfig = useUpdateStorageConfig();

  const [localConfig, setLocalConfig] =
    useState<StorageConfigData | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<string>('');

  /* ===========================
     SAFE INITIAL LOAD
  ============================*/
  useEffect(() => {
    if (!config) return;

    const safeCampuses = Array.isArray(config.campuses)
      ? config.campuses
      : [];

    const safeConfig: StorageConfigData = {
      ...config,
      campuses: safeCampuses,
    };

    setLocalConfig(JSON.parse(JSON.stringify(safeConfig)));

    if (safeCampuses.length > 0) {
      setSelectedCampus(safeCampuses[0].campus);
    }
  }, [config]);

  /* ===========================
     RESET WHEN OPEN
  ============================*/
  useEffect(() => {
    if (!open) {
      setLocalConfig(null);
      setSelectedCampus('');
      return;
    }

    if (!config) return;

    const safeCampuses = Array.isArray(config.campuses)
      ? config.campuses
      : [];

    const safeConfig: StorageConfigData = {
      ...config,
      campuses: safeCampuses,
    };

    setLocalConfig(JSON.parse(JSON.stringify(safeConfig)));

    if (safeCampuses.length > 0) {
      setSelectedCampus(safeCampuses[0].campus);
    }
  }, [open, config]);

  if (isLoading || !localConfig) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const safeCampuses = Array.isArray(localConfig.campuses)
    ? localConfig.campuses
    : [];

  const currentCampusConfig = safeCampuses.find(
    (c) => c.campus === selectedCampus
  );

  /* ===========================
     ACTIONS
  ============================*/

  const addCampusConfig = (campus: string) => {
    if (safeCampuses.find((c) => c.campus === campus)) return;

    setLocalConfig({
      ...localConfig,
      campuses: [...safeCampuses, { campus, shelves: [] }],
    });

    setSelectedCampus(campus);
  };

  const addShelf = () => {
    if (!currentCampusConfig) return;

    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    updated.campuses[campusIdx].shelves =
      updated.campuses[campusIdx].shelves || [];

    updated.campuses[campusIdx].shelves.push({
      id: genId(),
      code: '',
      label: '',
      boxes: [],
    });

    setLocalConfig({ ...updated });
  };

  const updateShelf = (
    shelfIdx: number,
    field: keyof ShelfConfig,
    value: string
  ) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    (updated.campuses[campusIdx].shelves[shelfIdx] as any)[field] = value;

    setLocalConfig({ ...updated });
  };

  const removeShelf = (shelfIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    updated.campuses[campusIdx].shelves.splice(shelfIdx, 1);
    setLocalConfig({ ...updated });
  };

  const addBox = (shelfIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    updated.campuses[campusIdx].shelves[shelfIdx].boxes =
      updated.campuses[campusIdx].shelves[shelfIdx].boxes || [];

    updated.campuses[campusIdx].shelves[shelfIdx].boxes.push({
      id: genId(),
      label: '',
    });

    setLocalConfig({ ...updated });
  };

  const updateBox = (
    shelfIdx: number,
    boxIdx: number,
    value: string
  ) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    updated.campuses[campusIdx].shelves[shelfIdx].boxes[boxIdx].label =
      value;

    setLocalConfig({ ...updated });
  };

  const removeBox = (shelfIdx: number, boxIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(
      (c) => c.campus === selectedCampus
    );

    if (campusIdx === -1) return;

    updated.campuses[campusIdx].shelves[shelfIdx].boxes.splice(
      boxIdx,
      1
    );

    setLocalConfig({ ...updated });
  };

  const handleSave = () => {
    updateConfig.mutate(localConfig, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const unusedCampuses = allCampuses.filter(
    (c) => !safeCampuses.find((cc) => cc.campus === c)
  );

  /* ===========================
     UI
  ============================*/

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Configurar Armazenamento
          </DialogTitle>
          <DialogDescription>
            Configure as prateleiras e caixas para cada campus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campus Buttons */}
          <div className="flex gap-2 flex-wrap">
            {safeCampuses.map((c) => (
              <Button
                key={c.campus}
                type="button"
                variant={
                  selectedCampus === c.campus
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() => setSelectedCampus(c.campus)}
              >
                {c.campus}
              </Button>
            ))}

            {unusedCampuses.length > 0 && (
              <Select onValueChange={addCampusConfig}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="+ Adicionar campus" />
                </SelectTrigger>
                <SelectContent>
                  {unusedCampuses.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Shelves */}
          {currentCampusConfig && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <h4 className="font-medium text-sm">
                  Prateleiras - {selectedCampus}
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addShelf}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Prateleira
                </Button>
              </div>

              {(currentCampusConfig.shelves || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  Nenhuma prateleira configurada.
                </p>
              )}

              <Accordion type="multiple" className="space-y-2">
                {(currentCampusConfig.shelves || []).map(
                  (shelf, shelfIdx) => (
                    <AccordionItem
                      key={shelf.id}
                      value={shelf.id}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger>
                        <div className="flex gap-2 text-sm">
                          <span className="font-mono font-bold">
                            {shelf.code || '?'}
                          </span>
                          <span>
                            {shelf.label || 'Sem nome'} (
                            {(shelf.boxes || []).length} caixas)
                          </span>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="pb-3">
                        <div className="space-y-3">
                          <Input
                            value={shelf.code}
                            onChange={(e) =>
                              updateShelf(
                                shelfIdx,
                                'code',
                                e.target.value
                              )
                            }
                            placeholder="Código"
                          />

                          <Input
                            value={shelf.label}
                            onChange={(e) =>
                              updateShelf(
                                shelfIdx,
                                'label',
                                e.target.value
                              )
                            }
                            placeholder="Descrição"
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                )}
              </Accordion>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>

            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
