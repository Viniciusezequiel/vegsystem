import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Package, Plus, Trash2, PenLine, Search, UserCheck, FileText, Edit3 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEquipmentList, useCreateEquipmentLoan, useCreateEquipment, Equipment } from '@/hooks/useEquipment';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SelectedEquipment {
  equipment: Equipment;
  quantity: number;
}

interface ManualEquipment {
  id: string; // temporary client-side id
  name: string;
  patrimony_code: string;
  quantity: number;
  location: string;
  campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
  description: string;
}

const loanSchema = z.object({
  borrower_name: z.string().min(1, 'Nome é obrigatório'),
  borrower_type: z.string().min(1, 'Tipo é obrigatório'),
  borrower_sector: z.string().min(1, 'Setor/Curso é obrigatório'),
  borrower_phone: z.string().min(1, 'Telefone é obrigatório'),
  purpose: z.string().min(1, 'Finalidade é obrigatória'),
  expected_return_date: z.string().min(1, 'Data de devolução é obrigatória'),
  authorizer_name: z.string().optional(),
  authorizer_contact: z.string().optional(),
  notes: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function EquipmentLoanForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedEquipment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [manualItems, setManualItems] = useState<ManualEquipment[]>([]);
  const [manualForm, setManualForm] = useState({
    name: '',
    patrimony_code: '',
    quantity: 1,
    location: '',
    campus: 'Campus I' as ManualEquipment['campus'],
    description: '',
  });
  
  const { data: equipment } = useEquipmentList();
  const createLoan = useCreateEquipmentLoan();
  const createEquipment = useCreateEquipment();

  const availableEquipment = useMemo(() => {
    return equipment?.filter(e => e.available_quantity > 0) || [];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
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
      borrower_type: 'aluno',
      borrower_sector: '',
      borrower_phone: '',
      purpose: '',
      expected_return_date: '',
      authorizer_name: '',
      authorizer_contact: '',
      notes: '',
    },
  });

  const borrowerType = form.watch('borrower_type');

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

  const handleAddManualEquipment = () => {
    if (!manualForm.name || !manualForm.patrimony_code || !manualForm.location) {
      toast({ title: 'Erro', description: 'Preencha nome, patrimônio e localização do equipamento', variant: 'destructive' });
      return;
    }
    setManualItems(prev => [...prev, { ...manualForm, id: crypto.randomUUID() }]);
    setManualForm({ name: '', patrimony_code: '', quantity: 1, location: '', campus: 'Campus I', description: '' });
  };

  const handleRemoveManualEquipment = (id: string) => {
    setManualItems(prev => prev.filter(item => item.id !== id));
  };

  const totalItems = selectedItems.length + manualItems.length;

  const onSubmit = async (data: LoanFormData) => {
    if (totalItems === 0) {
      toast({ title: 'Erro', description: 'Selecione ou adicione pelo menos um equipamento', variant: 'destructive' });
      return;
    }

    if (!signature) {
      toast({ title: 'Erro', description: 'A assinatura do solicitante é obrigatória', variant: 'destructive' });
      return;
    }

    if (!acceptedTerms) {
      toast({ title: 'Erro', description: 'É necessário aceitar o termo de responsabilidade', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Process registered equipment loans
      for (const item of selectedItems) {
        await createLoan.mutateAsync({
          equipment_id: item.equipment.id,
          quantity_borrowed: item.quantity,
          borrower_name: data.borrower_name,
          borrower_sector: data.borrower_sector,
          borrower_phone: data.borrower_phone,
          expected_return_date: data.expected_return_date,
          notes: data.notes || undefined,
          borrower_signature: signature,
          borrower_type: data.borrower_type,
          purpose: data.purpose,
          authorizer_name: data.authorizer_name || undefined,
          authorizer_contact: data.authorizer_contact || undefined,
          collaborator_name: profile?.full_name || undefined,
        });
      }

      // Process manual equipment: create equipment first, then loan
      for (const manual of manualItems) {
        const newEquip = await createEquipment.mutateAsync({
          name: manual.name,
          patrimony_code: manual.patrimony_code,
          quantity: manual.quantity,
          available_quantity: manual.quantity,
          location: manual.location,
          campus: manual.campus,
          description: manual.description || null,
          category: null,
          image_url: null,
          status: 'available',
          allow_external_loan: true,
        });

        await createLoan.mutateAsync({
          equipment_id: newEquip.id,
          quantity_borrowed: manual.quantity,
          borrower_name: data.borrower_name,
          borrower_sector: data.borrower_sector,
          borrower_phone: data.borrower_phone,
          expected_return_date: data.expected_return_date,
          notes: data.notes ? `${data.notes}\n(Equipamento cadastrado manualmente via empréstimo)` : '(Equipamento cadastrado manualmente via empréstimo)',
          borrower_signature: signature,
          borrower_type: data.borrower_type,
          purpose: data.purpose,
          authorizer_name: data.authorizer_name || undefined,
          authorizer_contact: data.authorizer_contact || undefined,
          collaborator_name: profile?.full_name || undefined,
        });
      }
      
      toast({ title: 'Sucesso', description: `${totalItems} empréstimo(s) registrado(s) com sucesso` });
      navigate('/equipment/loans');
    } catch (error) {
      toast({ title: 'Erro', description: 'Falha ao registrar empréstimos', variant: 'destructive' });
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
            <p className="text-sm text-muted-foreground">Termo de Responsabilidade pelo Empréstimo e Uso de Equipamentos</p>
          </div>
        </div>

        {/* Equipment Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show all selected items (registered + manual) */}
            {(selectedItems.length > 0 || manualItems.length > 0) && (
              <div className="space-y-3 mb-4">
                {selectedItems.map((item) => (
                  <div key={item.equipment.id} className="flex items-center gap-4 p-3 rounded-lg border bg-secondary/20">
                    <div className="flex-1">
                      <p className="font-medium">{item.equipment.name}</p>
                      <p className="text-xs text-muted-foreground">Patrimônio: {item.equipment.patrimony_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.equipment.quantity > 1 ? (
                        <>
                          <Input
                            type="number"
                            min={1}
                            max={item.equipment.available_quantity}
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.equipment.id, parseInt(e.target.value) || 1)}
                            className="w-20 h-8"
                          />
                          <span className="text-xs text-muted-foreground">/ {item.equipment.available_quantity}</span>
                        </>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Patrimônio único</Badge>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemoveEquipment(item.equipment.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {manualItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border border-dashed bg-accent/10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Patrimônio: {item.patrimony_code} · {item.location} · {item.campus}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Qtd: {item.quantity}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemoveManualEquipment(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Tabs defaultValue="registered" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="registered" className="gap-2">
                  <Search className="h-4 w-4" />
                  Cadastrado
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Edit3 className="h-4 w-4" />
                  Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="registered" className="mt-4">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <Plus className="h-4 w-4" />
                      Buscar Equipamento Cadastrado
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start" sideOffset={4}>
                    <Command shouldFilter={false}>
                      <div className="flex items-center border-b px-3">
                        <Search className="h-4 w-4 shrink-0 opacity-50" />
                        <CommandInput placeholder="Buscar por nome ou patrimônio..." value={searchValue} onValueChange={setSearchValue} className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" />
                      </div>
                      <CommandList className="max-h-[300px] overflow-y-auto">
                        {filteredEquipment.length === 0 ? (
                          <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                        ) : (
                          <CommandGroup heading={`${filteredEquipment.length} equipamento(s) disponível(is)`}>
                            {filteredEquipment.slice(0, 50).map((equip) => (
                              <CommandItem key={equip.id} value={equip.id} onSelect={() => handleAddEquipment(equip)} className="cursor-pointer hover:bg-accent">
                                <div className="flex flex-col flex-1 gap-0.5">
                                  <span className="font-medium">{equip.name}</span>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Patrimônio: {equip.patrimony_code}</span>
                                    <span className="text-primary font-medium">{equip.available_quantity} disponível(is)</span>
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
              </TabsContent>

              <TabsContent value="manual" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Para itens que não estão cadastrados no sistema. O equipamento será cadastrado automaticamente ao registrar o empréstimo.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome do Equipamento *</Label>
                    <Input
                      placeholder="Ex: Projetor Epson X300"
                      value={manualForm.name}
                      onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código Patrimônio *</Label>
                    <Input
                      placeholder="Ex: PAT-12345"
                      value={manualForm.patrimony_code}
                      onChange={(e) => setManualForm(prev => ({ ...prev, patrimony_code: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização *</Label>
                    <Input
                      placeholder="Ex: Sala 101, Bloco A"
                      value={manualForm.location}
                      onChange={(e) => setManualForm(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Campus *</Label>
                    <Select
                      value={manualForm.campus}
                      onValueChange={(value) => setManualForm(prev => ({ ...prev, campus: value as ManualEquipment['campus'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Campus I">Campus I</SelectItem>
                        <SelectItem value="Campus II">Campus II</SelectItem>
                        <SelectItem value="Campus IV">Campus IV</SelectItem>
                        <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min={1}
                      value={manualForm.quantity}
                      onChange={(e) => setManualForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Descrição adicional (opcional)"
                      value={manualForm.description}
                      onChange={(e) => setManualForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleAddManualEquipment}>
                  <Plus className="h-4 w-4" />
                  Adicionar Equipamento Manual
                </Button>
              </TabsContent>
            </Tabs>

            {totalItems > 0 && (
              <Badge variant="secondary" className="mt-2">{totalItems} equipamento(s) selecionado(s)</Badge>
            )}
          </CardContent>
        </Card>

        {/* Borrower Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Identificação do Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Borrower Type */}
                <FormField
                  control={form.control}
                  name="borrower_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Solicitante *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aluno">Aluno</SelectItem>
                          <SelectItem value="professor">Professor</SelectItem>
                          <SelectItem value="funcionario">Funcionário</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        <FormLabel>{borrowerType === 'funcionario' ? 'Setor *' : 'Curso *'}</FormLabel>
                        {borrowerType === 'funcionario' ? (
                          <FormControl>
                            <Input placeholder="Ex: TI, Administrativo" {...field} />
                          </FormControl>
                        ) : (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o curso" />
                              </SelectTrigger>
                            </FormControl>
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
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Finalidade do Empréstimo *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a finalidade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Aula">Aula</SelectItem>
                            <SelectItem value="Reunião">Reunião</SelectItem>
                            <SelectItem value="Evento">Evento</SelectItem>
                            <SelectItem value="Projeto">Projeto</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <DatePickerInput value={field.value} onChange={field.onChange} placeholder="Selecionar data" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Authorizer info - only for students */}
                {borrowerType === 'aluno' && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-4">
                        Em caso de retirada por aluno, identificar o responsável que autorizou:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="authorizer_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Autorizador</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome do professor/responsável" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="authorizer_contact"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contato do Autorizador</FormLabel>
                              <FormControl>
                                <Input placeholder="E-mail ou telefone" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </>
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informações adicionais sobre o empréstimo..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Terms of Responsibility */}
                <Separator />
                <Card className="bg-muted/30 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Termo de Responsabilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground space-y-2">
                      <p>1- Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a instituição cobrará do responsável pelo empréstimo o valor de um equipamento equivalente.</p>
                      <p>2- Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente o setor de Recursos Didáticos.</p>
                      <p>3- Devolverei no prazo limite de até 01 (um) dia útil ao término da utilização, o(s) equipamento(s) completo(s) e em perfeito estado de conservação.</p>
                      <p>4- A não devolução do(s) equipamento(s) poderá acarretar em sanções administrativas.</p>
                      <p>5- Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.</p>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="accept-terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      />
                      <label htmlFor="accept-terms" className="text-sm font-medium cursor-pointer">
                        Li e aceito o Termo de Responsabilidade
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* Collaborator info */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Colaborador responsável pelo empréstimo:</span>{' '}
                    {profile?.full_name || 'Não identificado'}
                  </p>
                </div>

                {/* Signature Section */}
                <div className="space-y-2 pt-4 border-t">
                  <Label className="flex items-center gap-2">
                    <PenLine className="w-4 h-4" />
                    Assinatura do Solicitante *
                  </Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    O solicitante deve assinar abaixo para confirmar a retirada dos equipamentos.
                  </p>
                  <SignaturePad onSignatureChange={setSignature} width={350} height={150} />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => navigate('/equipment/loans')} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || totalItems === 0 || !signature || !acceptedTerms} className="w-full sm:w-auto">
                    {isSubmitting ? 'Registrando...' : `Registrar ${totalItems > 1 ? `${totalItems} Empréstimos` : 'Empréstimo'}`}
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
