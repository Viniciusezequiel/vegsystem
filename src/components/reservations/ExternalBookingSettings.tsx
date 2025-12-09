import { useState, useEffect } from 'react';
import { useExternalBookingSettings, useUpdateExternalBookingSettings, ExternalBookingSettings as Settings, BlockedPeriod } from '@/hooks/useAppSettings';
import { useReservationRooms } from '@/hooks/useReservations';
import { useRoomCombinations, useCreateRoomCombination, useDeleteRoomCombination } from '@/hooks/useRoomCombinations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Copy, Check, Loader2, Plus, Trash2, Calendar, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ExternalBookingSettings() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: settings, isLoading } = useExternalBookingSettings();
  const { data: rooms, isLoading: roomsLoading } = useReservationRooms();
  const { data: combinations, isLoading: combinationsLoading } = useRoomCombinations();
  const createCombination = useCreateRoomCombination();
  const deleteCombination = useDeleteRoomCombination();
  const updateSettings = useUpdateExternalBookingSettings();
  const { toast } = useToast();

  const [selectedParent, setSelectedParent] = useState<string>('');
  const [selectedLinkedRooms, setSelectedLinkedRooms] = useState<string[]>([]);

  const [formData, setFormData] = useState<Settings>({
    blocked: false,
    blocked_until: null,
    message: '',
    blocked_periods: [],
  });

  const [newPeriod, setNewPeriod] = useState<Omit<BlockedPeriod, 'id'>>({
    start_date: '',
    end_date: '',
    room_ids: [],
    message: '',
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        ...settings,
        blocked_periods: settings.blocked_periods || [],
      });
    }
  }, [settings]);

  const bookingUrl = `${window.location.origin}/booking`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'O link foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const handleAddPeriod = () => {
    if (!newPeriod.start_date || !newPeriod.end_date) {
      toast({
        title: 'Erro',
        description: 'Preencha as datas de início e fim.',
        variant: 'destructive',
      });
      return;
    }

    const period: BlockedPeriod = {
      ...newPeriod,
      id: crypto.randomUUID(),
    };

    setFormData({
      ...formData,
      blocked_periods: [...formData.blocked_periods, period],
    });

    setNewPeriod({
      start_date: '',
      end_date: '',
      room_ids: [],
      message: '',
    });
  };

  const handleRemovePeriod = (id: string) => {
    setFormData({
      ...formData,
      blocked_periods: formData.blocked_periods.filter((p) => p.id !== id),
    });
  };

  const handleToggleRoom = (roomId: string) => {
    setNewPeriod((prev) => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter((id) => id !== roomId)
        : [...prev.room_ids, roomId],
    }));
  };

  const handleSave = () => {
    updateSettings.mutate(formData, {
      onSuccess: () => setOpen(false),
    });
  };

  // Room combinations logic
  const existingLinkedRooms = combinations
    ?.filter((c) => c.parent_room_id === selectedParent)
    .map((c) => c.linked_room_id) || [];

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

  const handleToggleLinkedRoom = (roomId: string) => {
    setSelectedLinkedRooms((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [...prev, roomId]
    );
  };

  const combinationsByParent = combinations?.reduce((acc, combo) => {
    if (!acc[combo.parent_room_id]) {
      acc[combo.parent_room_id] = [];
    }
    acc[combo.parent_room_id].push(combo);
    return acc;
  }, {} as Record<string, typeof combinations>) || {};

  const getRoomName = (id: string) => rooms?.find((r) => r.id === id)?.name || 'Sala não encontrada';
  const getRoomCode = (id: string) => rooms?.find((r) => r.id === id)?.code || '';

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <SettingsIcon className="w-4 h-4" />
          Configurações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de Reservas Externas</DialogTitle>
        </DialogHeader>

        {isLoading || roomsLoading || combinationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="periods">Bloqueios</TabsTrigger>
              <TabsTrigger value="combinations">Combinações</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 mt-4">
              {/* Copy Link */}
              <div className="space-y-2">
                <Label>Link para Clientes Externos</Label>
                <div className="flex gap-2">
                  <Input
                    value={bookingUrl}
                    readOnly
                    className="bg-secondary/50 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link para que clientes externos possam fazer reservas.
                </p>
              </div>

              {/* Block All Bookings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Bloquear Todas as Reservas Externas</Label>
                    <p className="text-xs text-muted-foreground">
                      Impede todos os novos agendamentos por clientes externos
                    </p>
                  </div>
                  <Switch
                    checked={formData.blocked}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, blocked: checked })
                    }
                  />
                </div>

                {formData.blocked && (
                  <>
                    <div>
                      <Label htmlFor="blocked_until">Bloquear até (opcional)</Label>
                      <Input
                        id="blocked_until"
                        type="date"
                        value={formData.blocked_until || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, blocked_until: e.target.value || null })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Deixe vazio para bloquear indefinidamente
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="message">Mensagem para clientes</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        placeholder="Ex: Estamos em recesso. Retornaremos em Janeiro."
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="periods" className="space-y-6 mt-4">
              {/* Add New Period */}
              <div className="space-y-4 border rounded-lg p-4 bg-secondary/30">
                <Label className="text-sm font-medium">Novo Período de Bloqueio</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date" className="text-xs text-muted-foreground">
                      Data de Início
                    </Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newPeriod.start_date}
                      onChange={(e) =>
                        setNewPeriod({ ...newPeriod, start_date: e.target.value })
                      }
                    />
                  </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Ambientes (deixe vazio para bloquear todos)
                  </Label>
                  <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                    {rooms?.map((room) => (
                      <label
                        key={room.id}
                        className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded cursor-pointer"
                      >
                        <Checkbox
                          checked={newPeriod.room_ids.includes(room.id)}
                          onCheckedChange={() => handleToggleRoom(room.id)}
                        />
                        <span className="text-sm">
                          {room.code} - {room.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="period_message" className="text-xs text-muted-foreground">
                    Mensagem (opcional)
                  </Label>
                  <Input
                    id="period_message"
                    value={newPeriod.message}
                    onChange={(e) =>
                      setNewPeriod({ ...newPeriod, message: e.target.value })
                    }
                    placeholder="Ex: Manutenção programada"
                  />
                </div>

                <Button onClick={handleAddPeriod} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Período
                </Button>
              </div>

              {/* Existing Periods */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Períodos Configurados</Label>
                
                {formData.blocked_periods.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-secondary/20">
                    Nenhum período de bloqueio configurado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.blocked_periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-start justify-between border rounded-lg p-3 bg-secondary/20"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">
                              {formatDate(period.start_date)} - {formatDate(period.end_date)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {period.room_ids.length === 0 ? (
                              <Badge variant="outline" className="text-xs">
                                Todos os ambientes
                              </Badge>
                            ) : (
                              period.room_ids.map((roomId) => (
                                <Badge key={roomId} variant="secondary" className="text-xs">
                                  {getRoomCode(roomId)}
                                </Badge>
                              ))
                            )}
                          </div>
                          {period.message && (
                            <p className="text-xs text-muted-foreground">{period.message}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePeriod(period.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Room Combinations Tab */}
            <TabsContent value="combinations" className="space-y-6 mt-4">
              <p className="text-sm text-muted-foreground">
                Configure salas combinadas. Quando uma sala principal é reservada, as salas vinculadas são bloqueadas automaticamente.
              </p>

              {/* Add New Combination */}
              <div className="space-y-4 border rounded-lg p-4 bg-secondary/30">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Nova Combinação
                </Label>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Sala Principal (ex: 801/2)
                    </Label>
                    <Select value={selectedParent} onValueChange={setSelectedParent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a sala principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms?.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.code} - {room.name}
                          </SelectItem>
                        ))}
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
                                onCheckedChange={() => handleToggleLinkedRoom(room.id)}
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
            </TabsContent>
                    <Label htmlFor="end_date" className="text-xs text-muted-foreground">
                      Data de Fim
                    </Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newPeriod.end_date}
                      onChange={(e) =>
                        setNewPeriod({ ...newPeriod, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">
                    Ambientes (deixe vazio para bloquear todos)
                  </Label>
                  <div className="mt-2 max-h-32 overflow-y-auto border rounded-md p-2 bg-background">
                    {rooms?.map((room) => (
                      <label
                        key={room.id}
                        className="flex items-center gap-2 p-2 hover:bg-secondary/50 rounded cursor-pointer"
                      >
                        <Checkbox
                          checked={newPeriod.room_ids.includes(room.id)}
                          onCheckedChange={() => handleToggleRoom(room.id)}
                        />
                        <span className="text-sm">
                          {room.code} - {room.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="period_message" className="text-xs text-muted-foreground">
                    Mensagem (opcional)
                  </Label>
                  <Input
                    id="period_message"
                    value={newPeriod.message}
                    onChange={(e) =>
                      setNewPeriod({ ...newPeriod, message: e.target.value })
                    }
                    placeholder="Ex: Manutenção programada"
                  />
                </div>

                <Button onClick={handleAddPeriod} className="w-full gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Período
                </Button>
              </div>

              {/* Existing Periods */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Períodos Configurados</Label>
                
                {formData.blocked_periods.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-secondary/20">
                    Nenhum período de bloqueio configurado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.blocked_periods.map((period) => (
                      <div
                        key={period.id}
                        className="flex items-start justify-between border rounded-lg p-3 bg-secondary/20"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">
                              {formatDate(period.start_date)} - {formatDate(period.end_date)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {period.room_ids.length === 0 ? (
                              <Badge variant="outline" className="text-xs">
                                Todos os ambientes
                              </Badge>
                            ) : (
                              period.room_ids.map((roomId) => (
                                <Badge key={roomId} variant="secondary" className="text-xs">
                                  {getRoomName(roomId)}
                                </Badge>
                              ))
                            )}
                          </div>
                          {period.message && (
                            <p className="text-xs text-muted-foreground">{period.message}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePeriod(period.id)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <Button
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="w-full btn-gradient mt-4"
            >
              {updateSettings.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
