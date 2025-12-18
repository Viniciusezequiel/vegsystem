import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
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

type ConstaStatus = 'consta' | 'nao_consta';
type ChecklistFieldStatus = 'verificado' | 'pendente';

// Special field for NAAP resources
type NaapField = {
  id: string;
  label: string;
  status: ConstaStatus | null;
  isNaapPending: boolean; // Only NAAP can create pending
  pendingReason: string;
  treatment: string;
};

// Grouped category field
type CategoryField = {
  id: string;
  label: string;
  description: string;
  status: ChecklistFieldStatus | null;
  subItems: string[];
  selectedSubItems: string[]; // Which sub-items are pending
  pendingReason: string;
  treatment: string;
};

type Step = 'campus-turno' | 'rooms' | 'form';

// NAAP resources - Carteira de Obeso e Mesa PNE
const NAAP_FIELDS: Omit<NaapField, 'status' | 'isNaapPending' | 'pendingReason' | 'treatment'>[] = [
  { id: 'carteira_obeso', label: 'Carteira de Obeso' },
  { id: 'mesa_pne', label: 'Mesa PNE' },
];

// Grouped categories with sub-items
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
  
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('campus-turno');
  
  // Step 1: Campus and Shift
  const [selectedCampus, setSelectedCampus] = useState('');
  const [shift, setShift] = useState('');
  
  // Step 2: Room selection (single room only)
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  
  // Step 3: Form fields
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
  
  const [furnitureCount, setFurnitureCount] = useState('');
  const [observations, setObservations] = useState('');

  const { data: rooms } = useRoomsList();
  const createChecklist = useCreateChecklist();

  // Filter rooms by selected campus
  const filteredRooms = useMemo(() => {
    if (!selectedCampus || !rooms) return [];
    return rooms.filter(room => room.campus === selectedCampus);
  }, [rooms, selectedCampus]);

  const canProceedStep1 = selectedCampus && shift;
  const canProceedStep2 = selectedRoom !== '';
  
  // All fields must be answered
  const allNaapAnswered = naapFields.every(f => f.status !== null);
  const allCategoryAnswered = categoryFields.every(f => f.status !== null);
  const allFieldsAnswered = allNaapAnswered && allCategoryAnswered;
  
  // All pending items must have sub-items selected and treatment filled
  const allPendingValid = categoryFields.every(f => 
    f.status !== 'pendente' || (f.status === 'pendente' && f.selectedSubItems.length > 0 && f.treatment.trim())
  );
  
  // NAAP fields that are pending must have treatment
  const allNaapPendingValid = naapFields.every(f => 
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

  const handleRoomSelection = (roomId: string) => {
    setSelectedRoom(roomId);
    setRoomDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (!canProceedStep2 || !allFieldsAnswered || !allPendingValid || !allNaapPendingValid) return;

    // Create answers array from all fields
    const answersArray: { question_id: string; answer: boolean; notes?: string }[] = [];
    
    // Add NAAP fields
    naapFields.forEach(field => {
      answersArray.push({
        question_id: field.id,
        answer: field.status === 'consta',
        notes: field.isNaapPending 
          ? `Status: ${field.status === 'consta' ? 'Consta' : 'Não consta'} | Pendência NAAP | Tratativa: ${field.treatment}`
          : `Status: ${field.status === 'consta' ? 'Consta' : 'Não consta'}`,
      });
    });
    
    // Add category fields
    categoryFields.forEach(field => {
      answersArray.push({
        question_id: field.id,
        answer: field.status === 'verificado',
        notes: field.status === 'pendente' 
          ? `Itens pendentes: ${field.selectedSubItems.join(', ')} | Tratativa: ${field.treatment}`
          : undefined,
      });
    });

    // Add furniture count as observation
    const fullObservations = furnitureCount 
      ? `Quantidade de mobiliário: ${furnitureCount}${observations ? `\n${observations}` : ''}`
      : observations;

    // Create checklist for the selected room
    await createChecklist.mutateAsync({
      room_id: selectedRoom,
      shift,
      observations: fullObservations || undefined,
      answers: answersArray,
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
      { key: 'rooms', label: 'Salas', number: 2 },
      { key: 'form', label: 'Checklist', number: 3 },
    ];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, index) => (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              currentStep === step.key 
                ? 'bg-primary text-primary-foreground' 
                : steps.findIndex(s => s.key === currentStep) > index
                  ? 'bg-green-600 text-white'
                  : 'bg-muted text-muted-foreground'
            }`}>
              {step.number}
            </div>
            <span className={`ml-2 text-sm hidden sm:inline ${
              currentStep === step.key ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 mx-3 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (currentStep === 'campus-turno') {
              navigate('/rooms');
            } else {
              goToPreviousStep();
            }
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Checklist de Sala</h1>
            <p className="text-muted-foreground">
              {currentStep === 'campus-turno' && 'Selecione o campus e turno'}
              {currentStep === 'rooms' && 'Selecione as salas para verificar'}
              {currentStep === 'form' && 'Preencha o checklist'}
            </p>
          </div>
        </div>

        {getStepIndicator()}

        {/* Step 1: Campus and Shift */}
        {currentStep === 'campus-turno' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Campus e Turno
              </CardTitle>
              <CardDescription>
                Selecione o campus e o turno para filtrar as salas disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Campus *</Label>
                  <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o campus" />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.campus_enum.map((campus) => (
                        <SelectItem key={campus} value={campus}>
                          {campus}
                        </SelectItem>
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
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Room Selection */}
        {currentStep === 'rooms' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Selecionar Sala
              </CardTitle>
              <CardDescription>
                Selecione a sala do {selectedCampus} que deseja verificar no turno da {shift}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredRooms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma sala cadastrada para o campus {selectedCampus}
                </p>
              ) : (
                <div className="space-y-4">
                  <Popover open={roomDropdownOpen} onOpenChange={setRoomDropdownOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-auto min-h-[40px] py-2"
                      >
                        <span className={selectedRoom ? "text-foreground" : "text-muted-foreground"}>
                          {selectedRoom 
                            ? filteredRooms.find(r => r.id === selectedRoom)?.name || "Selecione a sala..."
                            : "Selecione a sala..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full min-w-[400px] p-0" align="start">
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
                                    "mr-2 h-4 w-4",
                                    selectedRoom === room.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <span className="font-medium">{room.name}</span>
                                  {room.floor && (
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      Andar: {room.floor}
                                    </span>
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
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Selecionada:</span>
                  <Badge 
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-destructive/10"
                    onClick={() => setSelectedRoom('')}
                  >
                    {filteredRooms.find(r => r.id === selectedRoom)?.name}
                    <X className="h-3 w-3" />
                  </Badge>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goToPreviousStep}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button onClick={goToNextStep} disabled={!canProceedStep2}>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Checklist Form */}
        {currentStep === 'form' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Checklist - {shift}
                </CardTitle>
                <CardDescription>
                  Verificando sala no {selectedCampus}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedRoom && (
                    <Badge variant="outline">
                      {filteredRooms.find(r => r.id === selectedRoom)?.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Furniture Count */}
            <Card>
              <CardHeader>
                <CardTitle>Mobiliário</CardTitle>
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

            {/* NAAP Resources - Carteira de Obeso e Mesa PNE */}
            <Card>
              <CardHeader>
                <CardTitle>Recursos NAAP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {naapFields.map((field) => (
                  <div key={field.id} className="space-y-3 pb-4 border-b last:border-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <Label className="font-medium text-base">{field.label}</Label>
                      <Select
                        value={field.status || ''}
                        onValueChange={(value) => handleNaapStatusChange(field.id, value as ConstaStatus)}
                      >
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consta">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Consta
                            </span>
                          </SelectItem>
                          <SelectItem value="nao_consta">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-500" />
                              Não Consta
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {field.status === 'nao_consta' && (
                      <div className="pl-0 sm:pl-4 space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`naap-pending-${field.id}`}
                            checked={field.isNaapPending}
                            onCheckedChange={(checked) => handleNaapPendingChange(field.id, checked === true)}
                          />
                          <Label 
                            htmlFor={`naap-pending-${field.id}`}
                            className="text-sm text-muted-foreground cursor-pointer"
                          >
                            Gerar pendência NAAP
                          </Label>
                        </div>
                        
                        {field.isNaapPending && (
                          <div className="space-y-2">
                            <Label className="text-sm text-destructive font-medium">
                              Tratativa *
                            </Label>
                            <Input
                              placeholder="Descreva a tratativa para a demanda..."
                              value={field.treatment}
                              onChange={(e) => handleNaapTreatmentChange(field.id, e.target.value)}
                              className="border-destructive/50"
                            />
                            <p className="text-xs text-muted-foreground">
                              Obrigatório: A tratativa será direcionada para as demandas do colaborador
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Category Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Itens de Verificação</CardTitle>
                <CardDescription>
                  Selecione o status de cada categoria. Para pendências, selecione os itens específicos e preencha a tratativa obrigatória.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {categoryFields.map((field) => (
                  <div key={field.id} className="space-y-3 pb-4 border-b last:border-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1">
                        <Label className="font-semibold text-base block">{field.label}</Label>
                        <span className="text-sm text-muted-foreground block mt-1">
                          Itens: {field.subItems.join(', ')}
                        </span>
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
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Verificado
                            </span>
                          </SelectItem>
                          <SelectItem value="pendente">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              Pendente
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {field.status === 'pendente' && (
                      <div className="pl-0 sm:pl-4 space-y-4 bg-muted/30 p-4 rounded-lg">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Selecione os itens com pendência *
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {field.subItems.map((subItem) => (
                              <div 
                                key={subItem}
                                className={cn(
                                  "flex items-center space-x-2 px-3 py-2 rounded-md border cursor-pointer transition-colors",
                                  field.selectedSubItems.includes(subItem)
                                    ? "bg-destructive/10 border-destructive/50"
                                    : "bg-background hover:bg-muted"
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
                            <p className="text-xs text-destructive">
                              Selecione pelo menos um item pendente
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-sm text-destructive font-medium">
                            Tratativa *
                          </Label>
                          <Input
                            placeholder="Descreva a tratativa para a demanda..."
                            value={field.treatment}
                            onChange={(e) => handleCategoryTreatmentChange(field.id, e.target.value)}
                            className="border-destructive/50"
                          />
                          <p className="text-xs text-muted-foreground">
                            Obrigatório: A tratativa será direcionada para as demandas do colaborador
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* General Observations */}
            <Card>
              <CardHeader>
                <CardTitle>Observações Gerais</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Adicione observações gerais sobre as salas verificadas..."
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-between gap-4">
              <Button variant="outline" onClick={goToPreviousStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!allFieldsAnswered || !allPendingValid || !allNaapPendingValid || createChecklist.isPending}
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
