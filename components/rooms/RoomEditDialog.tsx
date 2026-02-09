import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Room, RoomChecklistItem, useUpdateRoom } from '@/hooks/useRooms';
import { Constants } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type RoomEditDialogProps = {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RoomEditDialog({ room, open, onOpenChange }: RoomEditDialogProps) {
  const [name, setName] = useState('');
  const [campus, setCampus] = useState<Room['campus']>('Campus I');
  const [floor, setFloor] = useState('');
  const [capacity, setCapacity] = useState('');
  const [checklistItems, setChecklistItems] = useState<RoomChecklistItem[]>([]);
  const [newItemLabel, setNewItemLabel] = useState('');

  const updateRoom = useUpdateRoom();

  useEffect(() => {
    if (room) {
      setName(room.name);
      setCampus(room.campus);
      setFloor(room.floor || '');
      setCapacity(room.capacity ? String(room.capacity) : '');
      setChecklistItems(room.checklist_items || []);
    }
  }, [room]);

  const handleAddItem = () => {
    if (!newItemLabel.trim()) {
      toast.error('Digite o nome do item');
      return;
    }

    const newItem: RoomChecklistItem = {
      id: `item_${Date.now()}`,
      label: newItemLabel.trim(),
    };

    setChecklistItems(prev => [...prev, newItem]);
    setNewItemLabel('');
  };

  const handleRemoveItem = (itemId: string) => {
    setChecklistItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSave = async () => {
    if (!room) return;

    await updateRoom.mutateAsync({
      id: room.id,
      name,
      campus,
      floor: floor || null,
      capacity: capacity ? parseInt(capacity) : null,
      checklist_items: checklistItems,
    });

    onOpenChange(false);
  };

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Sala - {room.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Sala *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Sala 101"
              />
            </div>

            <div className="space-y-2">
              <Label>Campus *</Label>
              <Select value={campus} onValueChange={(v) => setCampus(v as Room['campus'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Constants.public.Enums.campus_enum.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Andar</Label>
                <Input
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  placeholder="Ex: 2º"
                />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Nº pessoas"
                />
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Itens Específicos do Checklist</Label>
              <span className="text-sm text-muted-foreground">
                {checklistItems.length} item(s)
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Adicione itens específicos desta sala que devem ser verificados no checklist.
            </p>

            {/* Add new item */}
            <div className="flex gap-2">
              <Input
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                placeholder="Nome do item (ex: Projetor Epson)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <Button type="button" onClick={handleAddItem} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Items list */}
            {checklistItems.length > 0 ? (
              <div className="space-y-2 border rounded-lg p-3">
                {checklistItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 bg-muted/50 rounded-md"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border rounded-lg border-dashed text-muted-foreground">
                Nenhum item específico cadastrado
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateRoom.isPending || !name.trim()}>
              {updateRoom.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
