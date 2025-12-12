import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ReservationRoom } from '@/hooks/useReservations';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

interface RoomEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: ReservationRoom | null;
  onSave: (data: Partial<ReservationRoom>) => void;
  isPending?: boolean;
}

export function RoomEditDialog({
  open,
  onOpenChange,
  room,
  onSave,
  isPending = false,
}: RoomEditDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    capacity: 30,
    description: '',
    location: '',
    campus: 'Campus I' as CampusEnum,
    is_active: true,
    auto_confirm: true,
    max_advance_days: null as number | null,
  });

  useEffect(() => {
    if (room) {
      setFormData({
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        description: room.description || '',
        location: room.location || '',
        campus: room.campus as CampusEnum,
        is_active: room.is_active,
        auto_confirm: (room as any).auto_confirm ?? true,
        max_advance_days: (room as any).max_advance_days ?? null,
      });
    }
  }, [room]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: room?.id,
      ...formData,
    });
  };

  const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Ambiente</DialogTitle>
          <DialogDescription>
            Atualize as informações do ambiente de reserva
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex: SALA-01"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="capacity">Capacidade *</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                required
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Sala de Reuniões Principal"
              required
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="campus">Campus *</Label>
              <Select
                value={formData.campus}
                onValueChange={(v) => setFormData({ ...formData, campus: v as CampusEnum })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione o campus" />
                </SelectTrigger>
                <SelectContent>
                  {campusOptions.map((campus) => (
                    <SelectItem key={campus} value={campus}>
                      {campus}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="location">Localização</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Ex: Bloco A, 2º andar"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do ambiente..."
              rows={3}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="max_advance_days">Antecedência Máxima (dias)</Label>
            <Input
              id="max_advance_days"
              type="number"
              min={1}
              value={formData.max_advance_days || ''}
              onChange={(e) => setFormData({ ...formData, max_advance_days: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="Sem limite"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">Deixe vazio para sem limite</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_confirm">Confirmação Automática</Label>
              <p className="text-xs text-muted-foreground">Quando desativado, reservas precisam de confirmação manual</p>
            </div>
            <Switch
              id="auto_confirm"
              checked={formData.auto_confirm}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_confirm: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active">Ambiente Ativo</Label>
              <p className="text-xs text-muted-foreground">Ambientes inativos não aparecem para reserva</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}