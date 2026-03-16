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
import { useStorageConfig, useUpdateStorageConfig, StorageConfigData, CampusStorageConfig, ShelfConfig, BoxConfig } from '@/hooks/useStorageConfig';
import type { Database } from '@/integrations/supabase/types';

const defaultCampuses = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

interface StorageConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const genId = () => Math.random().toString(36).substring(2, 9);

export function StorageConfigDialog({ open, onOpenChange }: StorageConfigDialogProps) {
  const { data: config, isLoading } = useStorageConfig();
  const updateConfig = useUpdateStorageConfig();
  const [localConfig, setLocalConfig] = useState<StorageConfigData | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<string>('');
  const [newCampusName, setNewCampusName] = useState('');

  useEffect(() => {
    if (config && !localConfig) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      if (config.campuses.length > 0) {
        setSelectedCampus(config.campuses[0].campus);
      }
    }
  }, [config, localConfig]);

  // Reset local config when dialog opens
  useEffect(() => {
    if (open && config) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      if (config.campuses.length > 0 && !selectedCampus) {
        setSelectedCampus(config.campuses[0].campus);
      }
    }
    if (!open) {
      setLocalConfig(null);
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

  const currentCampusConfig = localConfig.campuses.find(c => c.campus === selectedCampus);

  const addCampusConfig = (campus: string) => {
    if (localConfig.campuses.find(c => c.campus === campus)) return;
    setLocalConfig({
      ...localConfig,
      campuses: [...localConfig.campuses, { campus, shelves: [] }],
    });
    setSelectedCampus(campus);
  };

  const addShelf = () => {
    if (!currentCampusConfig) return;
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    updated.campuses[campusIdx].shelves.push({
      id: genId(),
      code: '',
      label: '',
      boxes: [],
    });
    setLocalConfig({ ...updated });
  };

  const updateShelf = (shelfIdx: number, field: keyof ShelfConfig, value: string) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    (updated.campuses[campusIdx].shelves[shelfIdx] as any)[field] = value;
    setLocalConfig({ ...updated });
  };

  const removeShelf = (shelfIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    updated.campuses[campusIdx].shelves.splice(shelfIdx, 1);
    setLocalConfig({ ...updated });
  };

  const addBox = (shelfIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    updated.campuses[campusIdx].shelves[shelfIdx].boxes.push({
      id: genId(),
      label: '',
    });
    setLocalConfig({ ...updated });
  };

  const updateBox = (shelfIdx: number, boxIdx: number, value: string) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    updated.campuses[campusIdx].shelves[shelfIdx].boxes[boxIdx].label = value;
    setLocalConfig({ ...updated });
  };

  const removeBox = (shelfIdx: number, boxIdx: number) => {
    const updated = { ...localConfig };
    const campusIdx = updated.campuses.findIndex(c => c.campus === selectedCampus);
    updated.campuses[campusIdx].shelves[shelfIdx].boxes.splice(boxIdx, 1);
    setLocalConfig({ ...updated });
  };

  const handleSave = () => {
    updateConfig.mutate(localConfig, {
      onSuccess: () => onOpenChange(false),
    });
  };

  // Combine default campuses with any custom ones already in config
  const existingCampusNames = localConfig.campuses.map(c => c.campus);
  const allAvailableCampuses = [...new Set([...defaultCampuses, ...existingCampusNames])];
  const unusedCampuses = allAvailableCampuses.filter(c => !localConfig.campuses.find(cc => cc.campus === c));

  const addCustomCampus = () => {
    const name = newCampusName.trim();
    if (!name || localConfig.campuses.find(c => c.campus === name)) return;
    addCampusConfig(name);
    setNewCampusName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Configurar Armazenamento
          </DialogTitle>
          <DialogDescription>
            Configure as prateleiras e caixas para cada campus. A estante é derivada do primeiro número da prateleira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campus selector */}
          <div className="flex gap-2 flex-wrap">
            {localConfig.campuses.map(c => (
              <Button
                key={c.campus}
                type="button"
                variant={selectedCampus === c.campus ? 'default' : 'outline'}
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
                  {unusedCampuses.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Shelves for selected campus */}
          {currentCampusConfig && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Prateleiras - {selectedCampus}</h4>
                <Button type="button" variant="outline" size="sm" onClick={addShelf}>
                  <Plus className="w-4 h-4 mr-1" />
                  Prateleira
                </Button>
              </div>

              {currentCampusConfig.shelves.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  Nenhuma prateleira configurada. Clique em "+ Prateleira" para começar.
                </p>
              )}

              <Accordion type="multiple" className="space-y-2">
                {currentCampusConfig.shelves.map((shelf, shelfIdx) => (
                  <AccordionItem key={shelf.id} value={shelf.id} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono font-bold">{shelf.code || '?'}</span>
                        <span className="text-muted-foreground">
                          {shelf.label || 'Sem nome'} ({shelf.boxes.length} caixas)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Código (ex: 1.3)</Label>
                            <Input
                              value={shelf.code}
                              onChange={e => updateShelf(shelfIdx, 'code', e.target.value)}
                              placeholder="1.3"
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição</Label>
                            <Input
                              value={shelf.label}
                              onChange={e => updateShelf(shelfIdx, 'label', e.target.value)}
                              placeholder="Variados"
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs">Caixas</Label>
                            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => addBox(shelfIdx)}>
                              <Plus className="w-3 h-3 mr-1" />
                              Caixa
                            </Button>
                          </div>
                          {shelf.boxes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma caixa</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {shelf.boxes.map((box, boxIdx) => (
                                <div key={box.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-1">
                                  <Input
                                    value={box.label}
                                    onChange={e => updateBox(shelfIdx, boxIdx, e.target.value)}
                                    placeholder="Nº"
                                    className="h-6 w-16 text-xs border-0 bg-transparent p-0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeBox(shelfIdx, boxIdx)}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() => removeShelf(shelfIdx)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remover prateleira
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
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
