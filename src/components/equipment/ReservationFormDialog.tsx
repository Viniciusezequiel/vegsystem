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
import { EquipmentSearchDropdown } from './EquipmentSearchDropdown';
import { Trash2 } from 'lucide-react';
import { useEquipmentList, Equipment } from '@/hooks/useEquipment';
import { useCreateEquipmentReservation } from '@/hooks/useEquipmentReservations';
import { toast } from 'sonner';

interface SelectedEquipment {
  equipment_id: string;
  equipment_name: string;
  patrimony_code: string;
  quantity: number;
  max_available: number;
  is_unique: boolean;
}

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationFormDialog({ open, onOpenChange }: ReservationFormDialogProps) {
  const [selectedEquipments, setSelectedEquipments] = useState<SelectedEquipment[]>([]);
  const [requesterName, setRequesterName] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterSector, setRequesterSector] = useState('');
  const [requesterType, setRequesterType] = useState('aluno');
  const [purpose, setPurpose] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: equipment } = useEquipmentList();
  const createReservation = useCreateEquipmentReservation();

  const availableEquipment = useMemo(() => {
    // For reservations, show all non-maintenance equipment (even borrowed ones, since they may return before pickup date)
    return equipment?.filter(e => e.status !== 'maintenance') || [];
  }, [equipment]);

  const resetForm = () => {
    setSelectedEquipments([]);
    setRequesterName('');
    setRequesterPhone('');
    setRequesterSector('');
    setRequesterType('aluno');
    setPurpose('');
    setScheduledDate('');
    setExpectedReturnDate('');
    setNotes('');
  };

  const handleToggleEquipment = (equip: Equipment) => {
    setSelectedEquipments(prev => {
      const exists = prev.find(s => s.equipment_id === equip.id);
      if (exists) {
        return prev.filter(s => s.equipment_id !== equip.id);
      }
      return [...prev, {
        equipment_id: equip.id,
        equipment_name: equip.name,
        patrimony_code: equip.patrimony_code,
        quantity: 1,
        max_available: equip.available_quantity,
        is_unique: equip.quantity <= 1,
      }];
    });
  };

  const handleQuantityChange = (equipmentId: string, newQty: number) => {
    setSelectedEquipments(prev =>
      prev.map(s =>
        s.equipment_id === equipmentId
          ? { ...s, quantity: Math.max(1, Math.min(newQty, s.max_available)) }
          : s
      )
    );
  };

  const handleRemoveEquipment = (equipmentId: string) => {
    setSelectedEquipments(prev => prev.filter(s => s.equipment_id !== equipmentId));
  };

  const handleSubmit = async () => {
    if (selectedEquipments.length === 0 || !requesterName || !requesterPhone || !requesterSector || !scheduledDate || !expectedReturnDate) {
      toast.error('Preencha todos os campos obrigatórios (incluindo data de devolução)');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    // Generate a shared group ID when reserving multiple items
    const groupId = selectedEquipments.length > 1 ? crypto.randomUUID() : undefined;

    for (const equip of selectedEquipments) {
      try {
        await createReservation.mutateAsync({
          equipment_id: equip.equipment_id,
          quantity_reserved: equip.quantity,
          requester_name: requesterName,
          requester_phone: requesterPhone,
          requester_sector: requesterSector,
          requester_type: requesterType,
          purpose: purpose || undefined,
          scheduled_pickup_date: scheduledDate,
          expected_return_date: expectedReturnDate,
          notes: notes || undefined,
          reservation_group_id: groupId,
        });
        successCount++;
      } catch (err: any) {
        errorMessages.push(`${equip.equipment_name}: ${err.message}`);
      }
    }

    setIsSubmitting(false);

    if (successCount > 0 && errorMessages.length === 0) {
      resetForm();
      onOpenChange(false);
    } else if (successCount > 0 && errorMessages.length > 0) {
      toast.error(`Algumas reservas falharam:\n${errorMessages.join('\n')}`);
      // Remove successful ones from the list
      setSelectedEquipments(prev => prev.filter(s => errorMessages.some(m => m.startsWith(s.equipment_name))));
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
            <Label>Equipamento(s) *</Label>
            <EquipmentSearchDropdown
              availableEquipment={availableEquipment}
              selectedEquipments={selectedEquipments}
              onToggleEquipment={handleToggleEquipment}
              placeholder={selectedEquipments.length > 0 ? `${selectedEquipments.length} equipamento(s) selecionado(s)` : 'Buscar e selecionar equipamentos...'}
            />

            {/* Selected equipment list with quantity controls */}
            {selectedEquipments.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedEquipments.map(equip => (
                  <div key={equip.equipment_id} className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/20">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{equip.equipment_name}</p>
                      <p className="text-xs text-muted-foreground">Patrimônio: {equip.patrimony_code}</p>
                    </div>
                    {!equip.is_unique ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={equip.max_available}
                          value={equip.quantity}
                          onChange={(e) => handleQuantityChange(equip.equipment_id, parseInt(e.target.value) || 1)}
                          className="w-20 h-8"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">/ {equip.max_available}</span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Único</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive flex-shrink-0" onClick={() => handleRemoveEquipment(equip.equipment_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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
              disabled={isSubmitting || selectedEquipments.length === 0 || !requesterName || !scheduledDate || !expectedReturnDate}
            >
              {isSubmitting ? 'Registrando...' : `Registrar Pré-Reserva${selectedEquipments.length > 1 ? ` (${selectedEquipments.length})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
