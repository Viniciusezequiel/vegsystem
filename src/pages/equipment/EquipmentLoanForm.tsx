import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { ArrowLeft, Package, Check, ChevronsUpDown, Search, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEquipmentList, useCreateEquipmentLoan, Equipment } from '@/hooks/useEquipment';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface SelectedEquipment {
  equipment: Equipment;
  quantity: number;
}

const loanSchema = z.object({
  borrower_name: z.string().min(1, 'Nome é obrigatório'),
  borrower_sector: z.string().min(1, 'Setor é obrigatório'),
  borrower_phone: z.string().min(1, 'Telefone é obrigatório'),
  expected_return_date: z.string().min(1, 'Data de devolução é obrigatória'),
  notes: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function EquipmentLoanForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedEquipment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: equipment } = useEquipmentList();
  const createLoan = useCreateEquipmentLoan();

  const availableEquipment = useMemo(() => {
    return equipment?.filter(e => e.available_quantity > 0) || [];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    // Exclude already selected items
    const selectedIds = selectedItems.map(s => s.equipment.id);
    const notSelected = availableEquipment.filter(e => !selectedIds.includes(e.id));
    
    if (!searchValue) return notSelected;
    const search = searchValue.toLowerCase();
    return notSelected.filter(e => 
      e.name.toLowerCase().includes(search) || 
      e.patrimony_code.toLowerCase().includes(search)
    );
  }, [availableEquipment, searchValue, selectedItems]);

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      borrower_name: '',
      borrower_sector: '',
      borrower_phone: '',
      expected_return_date: '',
      notes: '',
    },
  });

  const handleAddEquipment = (equip: Equipment) => {
    setSelectedItems(prev => [...prev, { equipment: equip, quantity: 1 }]);
    setOpen(false);
    setSearchValue('');
  };

  const handleRemoveEquipment = (equipmentId: string) => {
    setSelectedItems(prev => prev.filter(item => item.equipment.id !== equipmentId));
  };

  const handleQuantityChange = (equipmentId: string, quantity: number) => {
    setSelectedItems(prev => 
      prev.map(item => 
        item.equipment.id === equipmentId 
          ? { ...item, quantity: Math.min(quantity, item.equipment.available_quantity) }
          : item
      )
    );
  };

  const onSubmit = async (data: LoanFormData) => {
    if (selectedItems.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos um equipamento',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create loans for all selected items
      for (const item of selectedItems) {
        await createLoan.mutateAsync({
          equipment_id: item.equipment.id,
          quantity_borrowed: item.quantity,
          borrower_name: data.borrower_name,
          borrower_sector: data.borrower_sector,
          borrower_phone: data.borrower_phone,
          expected_return_date: data.expected_return_date,
          notes: data.notes || undefined,
        });
      }
      
      toast({
        title: 'Sucesso',
        description: `${selectedItems.length} empréstimo(s) registrado(s) com sucesso`,
      });
      navigate('/equipment/loans');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao registrar empréstimos',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/equipment/loans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Novo Empréstimo</h1>
            <p className="text-sm text-muted-foreground">Registre um ou mais empréstimos de equipamentos</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Equipment List */}
            {selectedItems.length > 0 && (
              <div className="space-y-3 mb-4">
                {selectedItems.map((item) => (
                  <div 
                    key={item.equipment.id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-secondary/20"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.equipment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Patrimônio: {item.equipment.patrimony_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={item.equipment.available_quantity}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.equipment.id, parseInt(e.target.value) || 1)}
                        className="w-20 h-8"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {item.equipment.available_quantity}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveEquipment(item.equipment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Equipment Button */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Equipamento
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <div className="flex items-center border-b px-3">
                    <Search className="h-4 w-4 shrink-0 opacity-50" />
                    <CommandInput 
                      placeholder="Buscar por nome ou patrimônio..." 
                      value={searchValue}
                      onValueChange={setSearchValue}
                      className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredEquipment.map((equip) => (
                        <CommandItem
                          key={equip.id}
                          value={equip.id}
                          onSelect={() => handleAddEquipment(equip)}
                        >
                          <div className="flex flex-col flex-1">
                            <span>{equip.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Patrimônio: {equip.patrimony_code} | Disponível: {equip.available_quantity}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedItems.length > 0 && (
              <Badge variant="secondary" className="mt-2">
                {selectedItems.length} equipamento(s) selecionado(s)
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Solicitante</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="borrower_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Solicitante *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="borrower_sector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Setor *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: TI, Administrativo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="borrower_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone para Contato *</FormLabel>
                        <FormControl>
                          <Input placeholder="(00) 00000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expected_return_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Prevista de Devolução *</FormLabel>
                        <FormControl>
                          <DatePickerInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Selecionar data"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais sobre o empréstimo..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/equipment/loans')}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || selectedItems.length === 0} 
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting ? 'Registrando...' : `Registrar ${selectedItems.length > 1 ? `${selectedItems.length} Empréstimos` : 'Empréstimo'}`}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}