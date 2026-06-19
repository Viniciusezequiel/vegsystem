import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Pencil, MapPin, Search, X, Package, Upload } from 'lucide-react';
import { useReservationRooms, type ReservationRoom } from '@/hooks/useRoomReservations';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];
const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

type RoomWithExtras = ReservationRoom & {
  observations?: string | null;
  equipment?: string[] | null;
};

export default function ReservationRoomsManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: rooms, isLoading } = useReservationRooms();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoomWithExtras | null>(null);
  const [saving, setSaving] = useState(false);
  const [equipInput, setEquipInput] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    campus: '' as CampusEnum | '',
    capacity: 30,
    description: '',
    location: '',
    auto_confirm: true,
    max_advance_days: '',
    observations: '',
    equipment: [] as string[],
  });

  const resetForm = () => {
    setForm({ name: '', code: '', campus: '', capacity: 30, description: '', location: '', auto_confirm: true, max_advance_days: '', observations: '', equipment: [] });
    setEditing(null);
    setEquipInput('');
  };

  const openEdit = (room: RoomWithExtras) => {
    setEditing(room);
    setForm({
      name: room.name,
      code: room.code,
      campus: room.campus as CampusEnum,
      capacity: room.capacity,
      description: room.description || '',
      location: room.location || '',
      auto_confirm: room.auto_confirm,
      max_advance_days: room.max_advance_days?.toString() || '',
      observations: room.observations || '',
      equipment: Array.isArray(room.equipment) ? room.equipment : [],
    });
    setDialogOpen(true);
  };

  const addEquipment = () => {
    const v = equipInput.trim();
    if (!v) return;
    if (form.equipment.includes(v)) {
      setEquipInput('');
      return;
    }
    setForm(f => ({ ...f, equipment: [...f.equipment, v] }));
    setEquipInput('');
  };

  const removeEquipment = (item: string) => {
    setForm(f => ({ ...f, equipment: f.equipment.filter(e => e !== item) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.code || !form.campus) {
      toast.error('Preencha nome, código e campus.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        code: form.code,
        campus: form.campus as CampusEnum,
        capacity: form.capacity,
        description: form.description || null,
        location: form.location || null,
        auto_confirm: form.auto_confirm,
        max_advance_days: form.max_advance_days ? parseInt(form.max_advance_days) : null,
        observations: form.observations || null,
        equipment: form.equipment,
      };

      if (editing) {
        const { error } = await supabase
          .from('reservation_rooms')
          .update(payload as never)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Sala atualizada!');
      } else {
        const { error } = await supabase
          .from('reservation_rooms')
          .insert(payload as never);
        if (error) throw error;
        toast.success('Sala cadastrada!');
      }

      queryClient.invalidateQueries({ queryKey: ['reservation-rooms'] });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar sala';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (room: ReservationRoom) => {
    const { error } = await supabase
      .from('reservation_rooms')
      .update({ is_active: !room.is_active })
      .eq('id', room.id);

    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      queryClient.invalidateQueries({ queryKey: ['reservation-rooms'] });
      toast.success(room.is_active ? 'Sala desativada' : 'Sala ativada');
    }
  };

  const filtered = (rooms as RoomWithExtras[] | undefined)?.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.campus.toLowerCase().includes(q);
  }) || [];

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/reservations')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Gestão de Salas</h1>
              <p className="text-sm text-muted-foreground">Cadastre e gerencie as salas para reserva</p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova Sala
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar sala..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(room => (
              <Card key={room.id} className={!room.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{room.name}</h3>
                      <p className="text-xs text-muted-foreground">{room.code}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={room.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {room.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {room.campus}
                    </div>
                    <div>Capacidade: {room.capacity}</div>
                    {room.auto_confirm && <Badge variant="outline" className="text-[10px]">Auto-confirma</Badge>}
                  </div>
                  {Array.isArray(room.equipment) && room.equipment.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Package className="h-3 w-3" /> Equipamentos
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {room.equipment.slice(0, 4).map(eq => (
                          <Badge key={eq} variant="secondary" className="text-[10px]">{eq}</Badge>
                        ))}
                        {room.equipment.length > 4 && (
                          <Badge variant="outline" className="text-[10px]">+{room.equipment.length - 4}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {room.observations && (
                    <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">{room.observations}</p>
                  )}
                  <div className="flex justify-end gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(room)}>
                      {room.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(room)}>
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Sala' : 'Nova Sala'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sala de Reuniões" />
              </div>
              <div>
                <Label>Código *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SR-01" />
              </div>
              <div>
                <Label>Campus *</Label>
                <Select value={form.campus} onValueChange={v => setForm(f => ({ ...f, campus: v as CampusEnum }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {campusOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Capacidade</Label>
                <Input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <Label>Localização</Label>
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Bloco A, 2º andar" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <Label>Equipamentos disponíveis na sala</Label>
                <div className="flex gap-2">
                  <Input
                    value={equipInput}
                    onChange={e => setEquipInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEquipment(); } }}
                    placeholder="Ex: Projetor, Lousa branca, Ar-condicionado"
                  />
                  <Button type="button" variant="outline" onClick={addEquipment}>Adicionar</Button>
                </div>
                {form.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.equipment.map(eq => (
                      <Badge key={eq} variant="secondary" className="gap-1">
                        {eq}
                        <button type="button" onClick={() => removeEquipment(eq)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Pressione Enter para adicionar cada equipamento</p>
              </div>

              <div>
                <Label>Observações sobre o espaço</Label>
                <Textarea
                  value={form.observations}
                  onChange={e => setForm(f => ({ ...f, observations: e.target.value }))}
                  placeholder="Ex: Acesso por escada, possui janela ampla, sem tomadas no canto direito..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Antecedência máxima (dias)</Label>
                <Input type="number" value={form.max_advance_days} onChange={e => setForm(f => ({ ...f, max_advance_days: e.target.value }))} placeholder="Sem limite" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.auto_confirm} onCheckedChange={v => setForm(f => ({ ...f, auto_confirm: v }))} />
                <Label>Confirmar automaticamente</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
