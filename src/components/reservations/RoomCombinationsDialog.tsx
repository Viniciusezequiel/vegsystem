import { useState, useEffect } from 'react';
import { useReservationRooms } from '@/hooks/useReservations';
import { useRoomCombinations, useCreateRoomCombination, useDeleteRoomCombination } from '@/hooks/useRoomCombinations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Link2, Loader2, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function RoomCombinationsDialog() {
  const [open, setOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedLinkedRooms, setSelectedLinkedRooms] = useState<string[]>([]);
  
  const { data: rooms, isLoading: roomsLoading } = useReservationRooms();
  const { data: combinations, isLoading: combinationsLoading } = useRoomCombinations();
  const createCombination = useCreateRoomCombination();
  const deleteCombination = useDeleteRoomCombination();

  const isLoading = roomsLoading || combinationsLoading;

  // Reset selections when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedParent('');
      setSelectedLinkedRooms([]);
    }
  }, [open]);

  // Get rooms that are already linked to the selected parent
  const existingLinkedRooms = combinations
    ?.filter((c) => c.parent_room_id === selectedParent)
    .map((c) => c.linked_room_id) || [];

  // Available rooms to link (excluding parent and already linked)
  const availableToLink = rooms?.filter(
    (room) => room.id !== selectedParent && !existingLinkedRooms.includes(room.id)
  ) || [];

  const handleAddCombination = () => {
    if (!selectedParent || selectedLinkedRooms.length === 0) return;

    selectedLinkedRooms.forEach((linkedId) => {
      createCombination.mutate({
        parent_room_id: selectedParent,
        linked_room_id: linkedId,
      });
    });

    setSelectedLinkedRooms([]);
  };

  const handleToggleRoom = (roomId: string) => {
    setSelectedLinkedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  // Group combinations by parent room
  const combinationsByParent = combinations?.reduce((acc, combo) => {
    if (!acc[combo.parent_room_id]) {
      acc[combo.parent_room_id] = [];
    }
    acc[combo.parent_room_id].push(combo);
    return acc;
  }, {} as Record<string, typeof combinations>) || {};

  const getRoomName = (id: string) => rooms?.find((r) => r.id === id)?.name || 'Sala não encontrada';
  const getRoomCode = (id: string) => rooms?.find((r) => r.id === id)?.code || '';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Link2 className="w-4 h-4" />
          Combinar Salas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Combinações de Salas</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Quando uma sala combinada é reservada, as salas vinculadas também serão bloqueadas automaticamente.
              Por exemplo: ao reservar a sala 801/2, as salas 801 e 802 serão bloqueadas.
            </p>

            {/* Add New Combination */}
            <div className="space-y-4 border rounded-lg p-4 bg-secondary/30">
              <Label className="text-sm font-medium">Nova Combinação</Label>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="parent-room" className="text-xs text-muted-foreground">
                    Sala Principal (ex: 801/2)
                  </Label>
                  <Select value={selectedParent} onValueChange={setSelectedParent}>
                    <SelectTrigger id="parent-room">
                      <SelectValue placeholder="Selecione a sala principal" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.code} - {room.name}
                        </SelectItem>
                      ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                {selectedParent && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Salas Vinculadas (que serão bloqueadas junto)
                    </Label>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2 bg-background">
                      {availableToLink.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Todas as salas já estão vinculadas
                        </p>
                      ) : (
                        availableToLink.map((room) => (
                          <label
                            key={room.id}
                            className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedLinkedRooms.includes(room.id)}
                              onCheckedChange={() => handleToggleRoom(room.id)}
                            />
                            <span className="text-sm">
                              {room.code} - {room.name}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleAddCombination}
                  disabled={!selectedParent || selectedLinkedRooms.length === 0 || createCombination.isPending}
                  className="w-full gap-2"
                >
                  {createCombination.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Adicionar Vínculo
                </Button>
              </div>
            </div>

            {/* Existing Combinations */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Combinações Existentes</Label>
              
              {Object.keys(combinationsByParent).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-secondary/20">
                  Nenhuma combinação configurada
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(combinationsByParent).map(([parentId, combos]) => (
                    <div key={parentId} className="border rounded-lg p-3 bg-secondary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono">
                          {getRoomCode(parentId)}
                        </Badge>
                        <span className="font-medium text-sm">{getRoomName(parentId)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {combos.map((combo) => (
                          <Badge
                            key={combo.id}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            <span>{getRoomCode(combo.linked_room_id)}</span>
                            <button
                              onClick={() => deleteCombination.mutate(combo.id)}
                              className="ml-1 p-0.5 hover:bg-destructive/20 rounded"
                              disabled={deleteCombination.isPending}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
