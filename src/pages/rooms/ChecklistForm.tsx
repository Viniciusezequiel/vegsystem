import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContentState } from '@/components/layout/ContentState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight, ClipboardCheck, Building2, Clock, MapPin, Check, ChevronsUpDown, X } from 'lucide-react';
import { useRoomsList, useCreateChecklist } from '@/hooks/useRooms';
import { Badge } from '@/components/ui/badge';
import { Constants } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { RoomsModuleNav } from '@/components/rooms/RoomsModuleNav';

type ConstaStatus = 'consta' | 'nao_consta';
type ChecklistFieldStatus = 'verificado' | 'pendente';

type NaapField = {
  id: string;
  label: string;
  status: ConstaStatus | null;
  isNaapPending: boolean;
  pendingReason: string;
  treatment: string;
};

type CategoryField = {
  id: string;
  label: string;
  description: string;
  status: ChecklistFieldStatus | null;
  subItems: string[];
  selectedSubItems: string[];
  pendingReason: string;
  treatment: string;
};

type RoomChecklistItem = {
  id: string;
  label: string;
  status: ConstaStatus | null;
  isNaapPending: boolean;
  treatment: string;
};

type Step = 'campus-turno' | 'rooms' | 'form';

const NAAP_FIELDS: Omit<NaapField, 'status' | 'isNaapPending' | 'pendingReason' | 'treatment'>[] = [
  { id: 'carteira_obeso', label: 'Carteira de Obeso' },
  { id: 'mesa_pne', label: 'Mesa PNE' },
];

const CATEGORY_FIELDS: { id: string; label: string; description: string; subItems: string[] }[] = [
  {
    id: 'manutencao_mobiliario',
    label: 'Manutenção de Mobiliário',
    description: 'Carteiras, Mesa do Professor, Cadeira do Professor',
    subItems: ['Carteiras', 'Mesa do Professor', 'Cadeira do Professor']
  },
  {
    id: 'infraestrutura',
    label: 'Infraestrutura',
    description: 'Ar Condicionado, Lâmpadas, Forro, Limpeza, Parede, Cortinas',
    subItems: ['Ar Condicionado', 'Lâmpadas', 'Forro', 'Limpeza', 'Parede', 'Cortinas']
  },
  {
    id: 'recursos_midia',
    label: 'Recursos de Mídia',
    description: 'Internet, Computador, Microfone, Projetor, Som, Rack',
    subItems: ['Internet', 'Computador', 'Microfone', 'Projetor', 'Som', 'Rack']
  },
  {
    id: 'recurso_docente',
    label: 'Recurso Docente',
    description: 'Pincéis, Quadro/Lousa, Relógio, Apagador',
    subItems: ['Pincéis', 'Quadro/Lousa', 'Relógio', 'Apagador']
  },
];

export default function ChecklistForm() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('campus-turno');
  const [selectedCampus, setSelectedCampus] = useState('');
  const [shift, setShift] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);

  const [naapFields, setNaapFields] = useState<NaapField[]>(
    NAAP_FIELDS.map(f => ({
      ...f,
      status: null,
      isNaapPending: false,
      pendingReason: '',
      treatment: '',
    }))
  );

  const [categoryFields, setCategoryFields] = useState<CategoryField[]>(
    CATEGORY_FIELDS.map(f => ({
      ...f,
      status: null,
      selectedSubItems: [],
      pendingReason: '',
      treatment: '',
    }))
  );

  const [roomChecklistItems, setRoomChecklistItems] = useState<RoomChecklistItem[]>([]);
  const [furnitureCount, setFurnitureCount] = useState('');
  const [observations, setObservations] = useState('');

  const { data: rooms } = useRoomsList();
  const createChecklist = useCreateChecklist();

  const filteredRooms = useMemo(() => {
    if (!selectedCampus || !rooms) return [];
    return rooms.filter(room => room.campus === selectedCampus);
  }, [rooms, selectedCampus]);

  const selectedRoomData = useMemo(() => {
    if (!selectedRoom || !rooms) return null;
    return rooms.find(r => r.id === selectedRoom);
  }, [selectedRoom, rooms]);

  useMemo(() => {
    if (selectedRoomData?.checklist_items) {
      const items = selectedRoomData.checklist_items as { id: string; label: string }[];
      setRoomChecklistItems(
        items.map(item => ({
          id: item.id,
          label: item.label,
          status: null,
          isNaapPending: false,
          treatment: '',
        }))
      );
    } else {
      setRoomChecklistItems([]);
    }
  }, [selectedRoomData]);

  const canProceedStep1 = selectedCampus && shift;
  const canProceedStep2 = selectedRoom !== '';
  const allNaapAnswered = naapFields.every(f => f.status !== null);
  const allCategoryAnswered = categoryFields.every(f => f.status !== null);
  const allRoomItemsAnswered = roomChecklistItems.length === 0 || roomChecklistItems.every(f => f.status !== null);
  const allFieldsAnswered = allNaapAnswered && allCategoryAnswered && allRoomItemsAnswered;

  const allPendingValid = categoryFields.every(f =>
    f.status !== 'pendente' || (f.status === 'pendente' && f.selectedSubItems.length > 0 && f.treatment.trim())
  );

  const allNaapPendingValid = naapFields.every(f =>
    !f.isNaapPending || (f.isNaapPending && f.treatment.trim())
  );

  const allRoomItemsPendingValid = roomChecklistItems.every(f =>
    !f.isNaapPending || (f.isNaapPending && f.treatment.trim())
  );

  const handleNaapStatusChange = (fieldId: string, status: ConstaStatus) => {
    setNaapFields(prev => prev.map(f =>
      f.id === fieldId
        ? {
            ...f,
            status,
            isNaapPending: false,
            pendingReason: '',
            treatment: ''
          }
        : f
    ));
  };

  const handleNaapPendingChange = (fieldId: string, isPending: boolean) => {
    setNaapFields(prev => prev.map(f =>
      f.id === fieldId
        ? {
            ...f,
            isNaapPending: isPending,
            treatment: isPending ? f.treatment : ''
          }
        : f
    ));
  };

  const handleNaapTreatmentChange = (fieldId: string, treatment: string) => {
    setNaapFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, treatment } : f
    ));
  };

  const handleCategoryStatusChange = (fieldId: string, status: ChecklistFieldStatus) => {
    setCategoryFields(prev => prev.map(f =>
      f.id === fieldId
        ? {
            ...f,
            status,
            selectedSubItems: status === 'verificado' ? [] : f.selectedSubItems,
            pendingReason: status === 'verificado' ? '' : f.pendingReason,
            treatment: status === 'verificado' ? '' : f.treatment
          }
        : f
    ));
  };

  const handleCategorySubItemToggle = (fieldId: string, subItem: string) => {
    setCategoryFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      const isSelected = f.selectedSubItems.includes(subItem);
      return {
        ...f,
        selectedSubItems: isSelected
          ? f.selectedSubItems.filter(s => s !== subItem)
          : [...f.selectedSubItems, subItem]
      };
    }));
  };

  const handleCategoryTreatmentChange = (fieldId: string, treatment: string) => {
    setCategoryFields(prev => prev.map(f =>
      f.id === fieldId ? { ...f, treatment } : f
    ));
  };

  const handleRoomItemStatusChange = (itemId: string, status: ConstaStatus) => {
    setRoomChecklistItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, status, isNaapPending: false, treatment: '' }
        : item
    ));
  };

  const handleRoomItemPendingChange = (itemId: string, isPending: boolean) => {
    setRoomChecklistItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, isNaapPending: isPending, treatment: isPending ? item.treatment : '' }
        : item
    ));
  };

  const handleRoomItemTreatmentChange = (itemId: string, treatment: string) => {
    setRoomChecklistItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, treatment } : item
    ));
  };

  const handleRoomSelection = (roomId: string) => {
    setSelectedRoom(roomId);
    setRoomDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (!canProceedStep2 || !allFieldsAnswered || !allPendingValid || !allNaapPendingValid || !allRoomItemsPendingValid) return;

    const checklistSummary: string[] = [];

    checklistSummary.push('=== RECURSOS NAAP ===');
    naapFields.forEach(field => {
      const status = field.status === 'consta' ? 'Consta' : 'Não consta';
      if (field.isNaapPending) {
        checklistSummary.push(`• ${field.label}: ${status} [PENDÊNCIA] - Tratativa: ${field.treatment}`);
      } else {
        checklistSummary.push(`• ${field.label}: ${status}`);
      }
    });

    checklistSummary.push('\n=== CATEGORIAS ===');
    categoryFields.forEach(field => {
      const status = field.status === 'verificado' ? 'Verificado' : 'Pendente';
      if (field.status === 'pendente' && field.selectedSubItems.length > 0) {
        checklistSummary.push(`• ${field.label}: ${status}`);
        checklistSummary.push(`  Itens pendentes: ${field.selectedSubItems.join(', ')}`);
        checklistSummary.push(`  Tratativa: ${field.treatment}`);
      } else {
        checklistSummary.push(`• ${field.label}: ${status}`);
      }
    });

    if (roomChecklistItems.length > 0) {
      checklistSummary.push('\n=== RECURSOS DO AMBIENTE ===');
      roomChecklistItems.forEach(item => {
        const status = item.status === 'consta' ? 'Consta' : 'Não consta';
        if (item.isNaapPending) {
          checklistSummary.push(`• ${item.label}: ${status} [PENDÊNCIA] - Tratativa: ${item.treatment}`);
        } else {
          checklistSummary.push(`• ${item.label}: ${status}`);
        }
      });
    }

    if (furnitureCount) {
      checklistSummary.push(`\nQuantidade de mobiliário: ${furnitureCount}`);
    }

    if (observations) {
      checklistSummary.push(`\n=== OBSERVAÇÕES GERAIS ===\n${observations}`);
    }

    const fullObservations = checklistSummary.join('\n');

    await createChecklist.mutateAsync({
      room_id: selectedRoom,
      shift,
      observations: fullObservations,
      answers: [],
    });

    navigate('/rooms/checklists');
  };

  const goToNextStep = () => {
    if (currentStep === 'campus-turno' && canProceedStep1) {
      setCurrentStep('rooms');
    } else if (currentStep === 'rooms' && canProceedStep2) {
      setCurrentStep('form');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'rooms') {
      setCurrentStep('campus-turno');
    } else if (currentStep === 'form') {
      setCurrentStep('rooms');
    }
  };

  const getStepIndicator = () => {
    const steps = [
      { key: 'campus-turno', label: 'Campus e Turno', number: 1 },
      { key: 'rooms', label: 'Sala', number: 2 },
      { key: 'form', label: 'Checklist', number: 3 },
    ];
    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <div className="mb-5 flex items-center justify-center rounded-xl border border-border/60 bg-card/50 px-4 py-3">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
              currentStep === step.key
                ? 'bg-primary text-primary-foreground'
                : currentIndex > index
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
            )}>
              {currentIndex > index ? <Check className="h-4 w-4" /> : step.number}
            </div>
            <span className={cn(
              'ml-2 hidden text-sm sm:inline',
              currentStep === step.key ? 'font-medium text-foreground' : 'text-muted-foreground'
            )}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ArrowRight className="mx-3 h-4 w-4 text-muted-foreground/60" />
            )}
          </div>
        ))}
      </div>
    );
  };

  const headerDescription =
    currentStep === 'campus-turno'
      ? 'Selecione o campus e o turno'
      : currentStep === 'rooms'
        ? 'Selecione a sala que será verificada'
        : 'Preencha todos os itens do checklist';

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <RoomsModuleNav />

        <PageHeader
          title="Novo Checklist de Sala"
          description={headerDescription}
          actions={
            <Button
              variant="outline"
              onClick={() => {
                if (currentStep === 'campus-turno') navigate('/rooms');
                else goToPreviousStep();
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {currentStep === 'campus-turno' ? 'Voltar' : 'Etapa anterior'}
            </Button>
          }
        />

        {getStepIndicator()}

        {currentStep === 'campus-turno' && (
          <Card className="border-border/60 bg-card/65">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Campus e Turno
              </CardTitle>
              <CardDescription>Selecione os dados para filtrar as salas disponíveis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campus *</Label>
                  <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.campus_enum.map((campus) => (
                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Turno *
                  </Label>
                  <Select value={shift} onValueChange={setShift}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manhã">Manhã</SelectItem>
                      <SelectItem value="Tarde">Tarde</SelectItem>
                      <SelectItem value="Noite">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={goToNextStep} disabled={!canProceedStep1}>
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'rooms' && (
          <Card className="border-border/60 bg-card/65">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Selecionar Sala
              </CardTitle>
              <CardDescription>
                Selecione a sala do {selectedCampus} que deseja verificar no turno da {shift}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredRooms.length === 0 ? (
                <ContentState
                  icon={MapPin}
                  title="Nenhuma sala disponível"
                  description={`Não há salas cadastradas para ${selectedCampus}.`}
                  className="min-h-[140px]"
                />
              ) : (
                <div className="space-y-4">
                  <Popover open={roomDropdownOpen} onOpenChange={setRoomDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="h-auto min-h-[40px] w-full justify-between py-2"
                      >
                        <span className={selectedRoom ? 'text-foreground' : 'text-muted-foreground'}>
                          {selectedRoom
                            ? filteredRooms.find(r => r.id === selectedRoom)?.name || 'Selecione a sala...'
                            : 'Selecione a sala...'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-[320px] p-0 sm:min-w-[400px]" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar sala..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma sala encontrada.</CommandEmpty>
                          <CommandGroup>
                            {filteredRooms.map((room) => (
                              <CommandItem
                                key={room.id}
                                value={room.name}
                                onSelect={() => handleRoomSelection(room.id)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedRoom === room.id ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{room.name}</span>
                                  {room.floor && (
                                    <span className="ml-2 text-sm text-muted-foreground">Andar: {room.floor}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {selectedRoom && (
                <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
                  <span className="text-sm text-muted-foreground">Selecionada:</span>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1 hover:bg-destructive/10"
                    onClick={() => setSelectedRoom('')}
                  >
                    {filteredRooms.find(r => r.id === selectedRoom)?.name}
                    <X className="h-3 w-3" />
                  </Badge>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goToPreviousStep}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={goToNextStep} disabled={!canProceedStep2}>
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'form' && (
          <>
            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="h-4 w-4" />
                  Checklist - {shift}
                </CardTitle>
                <CardDescription>Verificando sala no {selectedCampus}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedRoom && (
                    <Badge variant="outline">{filteredRooms.find(r => r.id === selectedRoom)?.name}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mobiliário</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Quantidade de Mobiliário</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 40"
                    value={furnitureCount}
                    onChange={(e) => setFurnitureCount(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recursos NAAP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {naapFields.map((field) => (
                  <div key={field.id} className="space-y-3 border-b border-border/60 pb-4 last:border-0">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <Label className="text-base font-medium">{field.label}</Label>
                      <Select
                        value={field.status || ''}
                        onValueChange={(value) => handleNaapStatusChange(field.id, value as ConstaStatus)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consta">
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" />Consta</span>
                          </SelectItem>
                          <SelectItem value="nao_consta">
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-500" />Não Consta</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {field.status === 'nao_consta' && (
                      <div className="space-y-3 sm:pl-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`naap-pending-${field.id}`}
                            checked={field.isNaapPending}
                            onCheckedChange={(checked) => handleNaapPendingChange(field.id, checked === true)}
                          />
                          <Label htmlFor={`naap-pending-${field.id}`} className="cursor-pointer text-sm text-muted-foreground">
                            Gerar pendência NAAP
                          </Label>
                        </div>

                        {field.isNaapPending && (
                          <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3">
                            <Label className="text-sm font-medium text-destructive">Tratativa *</Label>
                            <Input
                              placeholder="Descreva a tratativa para a demanda..."
                              value={field.treatment}
                              onChange={(e) => handleNaapTreatmentChange(field.id, e.target.value)}
                              className="border-destructive/50"
                            />
                            <p className="text-xs text-muted-foreground">Obrigatório: a tratativa será direcionada para as demandas do colaborador.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Itens de Verificação</CardTitle>
                <CardDescription>
                  Selecione o status de cada categoria. Para pendências, selecione os itens específicos e preencha a tratativa obrigatória.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {categoryFields.map((field) => (
                  <div key={field.id} className="space-y-3 border-b border-border/60 pb-4 last:border-0">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="flex-1">
                        <Label className="block text-base font-semibold">{field.label}</Label>
                        <span className="mt-1 block text-sm text-muted-foreground">Itens: {field.subItems.join(', ')}</span>
                      </div>
                      <Select
                        value={field.status || ''}
                        onValueChange={(value) => handleCategoryStatusChange(field.id, value as ChecklistFieldStatus)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verificado">
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" />Verificado</span>
                          </SelectItem>
                          <SelectItem value="pendente">
                            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-yellow-500" />Pendente</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {field.status === 'pendente' && (
                      <div className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4 sm:ml-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Selecione os itens com pendência *</Label>
                          <div className="flex flex-wrap gap-2">
                            {field.subItems.map((subItem) => (
                              <div
                                key={subItem}
                                className={cn(
                                  'flex cursor-pointer items-center space-x-2 rounded-md border px-3 py-2 transition-colors',
                                  field.selectedSubItems.includes(subItem)
                                    ? 'border-destructive/50 bg-destructive/10'
                                    : 'bg-background hover:bg-muted'
                                )}
                                onClick={() => handleCategorySubItemToggle(field.id, subItem)}
                              >
                                <Checkbox
                                  checked={field.selectedSubItems.includes(subItem)}
                                  onCheckedChange={() => handleCategorySubItemToggle(field.id, subItem)}
                                />
                                <span className="text-sm">{subItem}</span>
                              </div>
                            ))}
                          </div>
                          {field.selectedSubItems.length === 0 && (
                            <p className="text-xs text-destructive">Selecione pelo menos um item pendente</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-destructive">Tratativa *</Label>
                          <Input
                            placeholder="Descreva a tratativa para a demanda..."
                            value={field.treatment}
                            onChange={(e) => handleCategoryTreatmentChange(field.id, e.target.value)}
                            className="border-destructive/50"
                          />
                          <p className="text-xs text-muted-foreground">Obrigatório: a tratativa será direcionada para as demandas do colaborador.</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {roomChecklistItems.length > 0 && (
              <Card className="border-border/60 bg-card/65">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recursos Específicos do Ambiente</CardTitle>
                  <CardDescription>Itens cadastrados especificamente para esta sala.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {roomChecklistItems.map((item) => (
                    <div key={item.id} className="space-y-3 border-b border-border/60 pb-4 last:border-0">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <Label className="text-base font-medium">{item.label}</Label>
                        <Select
                          value={item.status || ''}
                          onValueChange={(value) => handleRoomItemStatusChange(item.id, value as ConstaStatus)}
                        >
                          <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consta">
                              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" />Consta</span>
                            </SelectItem>
                            <SelectItem value="nao_consta">
                              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gray-500" />Não Consta</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {item.status === 'nao_consta' && (
                        <div className="space-y-3 sm:pl-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`room-item-pending-${item.id}`}
                              checked={item.isNaapPending}
                              onCheckedChange={(checked) => handleRoomItemPendingChange(item.id, checked === true)}
                            />
                            <Label htmlFor={`room-item-pending-${item.id}`} className="cursor-pointer text-sm text-muted-foreground">
                              Gerar pendência NAAP
                            </Label>
                          </div>

                          {item.isNaapPending && (
                            <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/[0.04] p-3">
                              <Label className="text-sm font-medium text-destructive">Tratativa *</Label>
                              <Input
                                placeholder="Descreva a tratativa para a demanda..."
                                value={item.treatment}
                                onChange={(e) => handleRoomItemTreatmentChange(item.id, e.target.value)}
                                className="border-destructive/50"
                              />
                              <p className="text-xs text-muted-foreground">Obrigatório: a tratativa será direcionada para as demandas do colaborador.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="border-border/60 bg-card/65">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Observações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Adicione observações gerais sobre a sala verificada..."
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-between gap-4">
              <Button variant="outline" onClick={goToPreviousStep}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!allFieldsAnswered || !allPendingValid || !allNaapPendingValid || !allRoomItemsPendingValid || createChecklist.isPending}
              >
                {createChecklist.isPending ? 'Salvando...' : 'Salvar Checklist'}
              </Button>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
