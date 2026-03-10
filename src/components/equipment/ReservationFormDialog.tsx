import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useEquipmentList, Equipment } from '@/hooks/useEquipment';
import { useCreateEquipmentReservation } from '@/hooks/useEquipmentReservations';
import { toast } from 'sonner';

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationFormDialog({ open, onOpenChange }: ReservationFormDialogProps) {
  const [equipOpen, setEquipOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterSector, setRequesterSector] = useState('');
  const [requesterType, setRequesterType] = useState('aluno');
  const [purpose, setPurpose] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: equipment } = useEquipmentList();
  const createReservation = useCreateEquipmentReservation();

  const availableEquipment = useMemo(() => {
    return equipment?.filter(e => e.status !== 'maintenance') || [];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    if (!searchValue) return availableEquipment;
    const search = searchValue.toLowerCase();
    return availableEquipment.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.patrimony_code.toLowerCase().includes(search)
    );
  }, [availableEquipment, searchValue]);

  const resetForm = () => {
    setSelectedEquipment(null);
    setQuantity(1);
    setRequesterName('');
    setRequesterPhone('');
    setRequesterSector('');
    setRequesterType('aluno');
    setPurpose('');
    setScheduledDate('');
    setExpectedReturnDate('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!selectedEquipment || !requesterName || !requesterPhone || !requesterSector || !scheduledDate || !expectedReturnDate) {
      toast.error('Preencha todos os campos obrigatórios (incluindo data de devolução)');
      return;
    }

    try {
      await createReservation.mutateAsync({
        equipment_id: selectedEquipment.id,
        quantity_reserved: quantity,
        requester_name: requesterName,
        requester_phone: requesterPhone,
        requester_sector: requesterSector,
        requester_type: requesterType,
        purpose: purpose || undefined,
        scheduled_pickup_date: scheduledDate,
        expected_return_date: expectedReturnDate,
        notes: notes || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Pré-Reserva de Equipamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Equipment Selection */}
          <div className="space-y-2">
            <Label>Equipamento *</Label>
            {selectedEquipment ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/20">
                <div className="flex-1">
                  <p className="font-medium">{selectedEquipment.name}</p>
                  <p className="text-xs text-muted-foreground">Patrimônio: {selectedEquipment.patrimony_code}</p>
                </div>
                {selectedEquipment.quantity > 1 ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={selectedEquipment.available_quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, selectedEquipment.available_quantity))}
                      className="w-20 h-8"
                    />
                    <span className="text-xs text-muted-foreground">/ {selectedEquipment.available_quantity}</span>
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-xs">Único</Badge>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSelectedEquipment(null)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Popover open={equipOpen} onOpenChange={setEquipOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Selecionar Equipamento
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <div className="flex items-center border-b px-3">
                      <Search className="h-4 w-4 shrink-0 opacity-50" />
                      <CommandInput placeholder="Buscar..." value={searchValue} onValueChange={setSearchValue} />
                    </div>
                    <CommandList className="max-h-[250px] overflow-y-auto">
                      {filteredEquipment.length === 0 ? (
                        <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {filteredEquipment.slice(0, 50).map((equip) => (
                            <CommandItem
                              key={equip.id}
                              value={equip.id}
                              onSelect={() => {
                                setSelectedEquipment(equip);
                                setQuantity(1);
                                setEquipOpen(false);
                                setSearchValue('');
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex flex-col flex-1 gap-0.5">
                                <span className="font-medium">{equip.name}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{equip.patrimony_code}</span>
                                  {equip.quantity > 1 ? (
                                    <span className="text-primary font-medium">{equip.available_quantity} disp.</span>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Único</Badge>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Requester Info */}
          <div className="space-y-2">
            <Label>Tipo de Solicitante *</Label>
            <Select value={requesterType} onValueChange={setRequesterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aluno">Aluno</SelectItem>
                <SelectItem value="professor">Professor</SelectItem>
                <SelectItem value="funcionario">Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Solicitante *</Label>
              <Input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>{requesterType === 'funcionario' ? 'Setor *' : 'Curso *'}</Label>
              {requesterType === 'funcionario' ? (
                <Input value={requesterSector} onChange={(e) => setRequesterSector(e.target.value)} placeholder="Ex: TI" />
              ) : (
                <Select value={requesterSector} onValueChange={setRequesterSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicina">Medicina</SelectItem>
                    <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                    <SelectItem value="Odontologia">Odontologia</SelectItem>
                    <SelectItem value="Enfermagem">Enfermagem</SelectItem>
                    <SelectItem value="Fonoaudiologia">Fonoaudiologia</SelectItem>
                    <SelectItem value="Psicologia">Psicologia</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Finalidade</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aula">Aula</SelectItem>
                  <SelectItem value="Reunião">Reunião</SelectItem>
                  <SelectItem value="Evento">Evento</SelectItem>
                  <SelectItem value="Projeto">Projeto</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Prevista para Retirada *</Label>
              <DatePickerInput value={scheduledDate} onChange={setScheduledDate} placeholder="Selecionar data" />
            </div>
            <div className="space-y-2">
              <Label>Data Prevista para Devolução *</Label>
              <DatePickerInput value={expectedReturnDate} onChange={setExpectedReturnDate} placeholder="Selecionar data" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais..." rows={2} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createReservation.isPending || !selectedEquipment || !requesterName || !scheduledDate || !expectedReturnDate}
            >
              {createReservation.isPending ? 'Registrando...' : 'Registrar Pré-Reserva'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
