import { selectedLoanPayload, type SelectedLoanItem } from '@/lib/equipmentLoanItems';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  Loader2,
  Package,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEquipmentList, useCreateBatchLoans, Equipment } from '@/hooks/useEquipment';
import { useMarkReservationPickedUp } from '@/hooks/useEquipmentReservations';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type ReservationItem = {
  reservationId: string;
  equipmentId: string;
  equipmentName: string;
  equipmentPatrimonyCode: string;
  quantity: number;
};

type ReservationState = {
  reservationIds: string[];
  items: ReservationItem[];
  borrowerName: string;
  borrowerPhone: string;
  borrowerSector: string;
  borrowerType: string;
  purpose: string | null;
  notes: string | null;
};

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

function borrowerTypeLabel(value: string) {
  if (value === 'professor') return 'Professor';
  if (value === 'funcionario') return 'Funcionário';
  return 'Aluno';
}

function formatDateLabel(value: string) {
  if (!value) return 'Não informada';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export default function EquipmentLoanForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedLoanItem[]>([]);
  const manualKey = useRef(0);
  const [manualName, setManualName] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const reservationData = (location.state as { fromReservation?: ReservationState } | null)?.fromReservation;

  const { data: equipment } = useEquipmentList();
  const createBatchLoans = useCreateBatchLoans();
  const markPickedUp = useMarkReservationPickedUp();

  useEffect(() => {
    if (reservationData && equipment && selectedItems.length === 0) {
      const items: SelectedLoanItem[] = [];
      for (const resItem of reservationData.items) {
        const equip = equipment.find(e => e.id === resItem.equipmentId);
        if (equip) {
          items.push({ kind: 'inventory', equipment: equip, quantity: resItem.quantity });
        }
      }
      if (items.length > 0) {
        setSelectedItems(items);
      }
    }
  }, [reservationData, equipment, selectedItems.length]);

  const availableEquipment = useMemo(() => {
    return equipment?.filter(e => e.status !== 'maintenance') || [];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    const selectedIds = selectedItems.flatMap(s => s.kind === 'inventory' ? [s.equipment.id] : []);
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
      borrower_name: reservationData?.borrowerName || '',
      borrower_type: reservationData?.borrowerType || 'aluno',
      borrower_sector: reservationData?.borrowerSector || '',
      borrower_phone: reservationData?.borrowerPhone || '',
      purpose: reservationData?.purpose || '',
      expected_return_date: '',
      authorizer_name: '',
      authorizer_contact: '',
      notes: reservationData?.notes || '',
    },
  });

  const borrowerType = form.watch('borrower_type');
  const borrowerName = form.watch('borrower_name');
  const borrowerSector = form.watch('borrower_sector');
  const purpose = form.watch('purpose');
  const expectedReturnDate = form.watch('expected_return_date');

  const handleAddEquipment = (equip: Equipment) => {
    setSelectedItems(prev => [...prev, { kind: 'inventory', equipment: equip, quantity: 1 }]);
    setOpen(false);
    setSearchValue('');
  };

  const itemKey = (item: SelectedLoanItem) => item.kind === 'inventory' ? item.equipment.id : 'manual-' + item.key;
  const handleRemoveEquipment = (key: string) => setSelectedItems(prev => prev.filter(item => itemKey(item) !== key));
  const handleQuantityChange = (key: string, quantity: number) => {
    setSelectedItems(prev => prev.map(item => itemKey(item) === key
      ? { ...item, quantity: Math.max(1, item.kind === 'inventory' ? Math.min(quantity, item.equipment.available_quantity) : quantity) } : item));
  };

  const addManualItem = () => {
    if (!manualName.trim() || !Number.isInteger(manualQuantity) || manualQuantity < 1) {
      toast({ title: 'Informe nome e quantidade válida', variant: 'destructive' });
      return;
    }
    const key = ++manualKey.current;
    setSelectedItems(prev => [...prev, { kind: 'manual', key, name: manualName.trim(), quantity: manualQuantity }]);
    setManualName('');
    setManualQuantity(1);
    setManualOpen(false);
  };

  const totalItems = selectedItems.length;
  const totalUnits = selectedItems.reduce((total, item) => total + item.quantity, 0);

  const onSubmit = async (data: LoanFormData) => {
    if (totalItems === 0) {
      toast({ title: 'Erro', description: 'Selecione pelo menos um equipamento', variant: 'destructive' });
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
      const reservedEquipmentIds = new Set(
        reservationData?.items.map(i => i.equipmentId) || []
      );

      const groupId = selectedItems.length > 1 ? crypto.randomUUID() : undefined;

      await createBatchLoans.mutateAsync({
        items: selectedItems.map(item => selectedLoanPayload(item, reservedEquipmentIds)),
        common: {
          borrower_name: data.borrower_name,
          borrower_sector: data.borrower_sector,
          borrower_phone: data.borrower_phone,
          expected_return_date: data.expected_return_date,
          notes: data.notes || undefined,
          borrower_signature: signature || undefined,
          borrower_type: data.borrower_type,
          purpose: data.purpose,
          authorizer_name: data.authorizer_name || undefined,
          authorizer_contact: data.authorizer_contact || undefined,
          collaborator_name: profile?.full_name || undefined,
          loan_group_id: groupId,
        },
      });

      if (reservationData?.reservationIds?.length) {
        await markPickedUp.mutateAsync(reservationData.reservationIds);
      }

      toast({ title: 'Sucesso', description: `${totalItems} empréstimo(s) registrado(s) com sucesso` });
      navigate('/equipment/loans');
    } catch (error: any) {
      toast({ title: 'Erro', description: error?.message || 'Falha ao registrar empréstimos', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="relative isolate -m-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-primary/[0.06] via-background/10 to-blue-500/[0.045] p-2 sm:-m-3 sm:p-3">
        <div className="pointer-events-none absolute -left-36 top-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-8 h-96 w-96 rounded-full bg-blue-500/[0.08] blur-3xl" />

        <div className="relative space-y-5">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/20 to-blue-500/10 text-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.8)]">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                  {reservationData ? 'Retirada de pré-reserva' : 'Empréstimos'}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {reservationData ? 'Retirada de Pré-Reserva' : 'Novo Empréstimo'}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reservationData
                    ? 'Confira os dados da reserva e conclua a retirada dos equipamentos.'
                    : 'Termo de responsabilidade pelo empréstimo e uso de equipamentos.'}
                </p>
              </div>
            </div>

            <Button variant="outline" onClick={() => navigate('/equipment/loans')} className="h-10 gap-2 rounded-xl self-start lg:self-auto">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </section>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <Card className="overflow-hidden border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.9)] backdrop-blur-xl">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-base font-semibold">Equipamentos</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Selecione os equipamentos que serão emprestados.</p>
                          </div>
                        </div>

                        {!reservationData && (
                          <Button type="button" variant="outline" onClick={() => setManualOpen(value => !value)} className="h-9 rounded-xl border-primary/25 bg-primary/[0.035] hover:bg-primary/[0.08]">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar item avulso
                          </Button>
                        )}
                      </div>

                      {manualOpen && !reservationData && (
                        <div className="mt-4 grid items-end gap-3 rounded-xl border border-border/40 bg-background/25 p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                          <div>
                            <Label htmlFor="manual-item-name" className="text-xs">Nome do item *</Label>
                            <Input id="manual-item-name" value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Ex: Chave sala 601" className="mt-1.5" />
                          </div>
                          <div>
                            <Label htmlFor="manual-item-quantity" className="text-xs">Quantidade</Label>
                            <Input id="manual-item-quantity" type="number" min={1} step={1} value={manualQuantity} onChange={event => setManualQuantity(Number(event.target.value))} className="mt-1.5" />
                          </div>
                          <Button type="button" onClick={addManualItem}>Adicionar</Button>
                        </div>
                      )}

                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" className="mt-4 h-11 w-full justify-start rounded-xl border-primary/35 bg-background/25 px-3 text-muted-foreground hover:border-primary/55 hover:bg-primary/[0.05] hover:text-foreground">
                            <Search className="mr-3 h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">Buscar equipamento</span>
                            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Nome ou patrimônio</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[420px] max-w-[calc(100vw-2rem)] p-0 sm:w-[540px]" align="start" sideOffset={6}>
                          <Command shouldFilter={false}>
                            <div className="flex items-center border-b px-3">
                              <Search className="h-4 w-4 shrink-0 opacity-50" />
                              <CommandInput
                                placeholder="Buscar por nome ou patrimônio..."
                                value={searchValue}
                                onValueChange={setSearchValue}
                                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                              />
                            </div>
                            <CommandList className="max-h-[320px] overflow-y-auto">
                              {filteredEquipment.length === 0 ? (
                                <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                              ) : (
                                <CommandGroup heading={`${filteredEquipment.length} equipamento(s) disponível(is)`}>
                                  {filteredEquipment.slice(0, 50).map((equip) => (
                                    <CommandItem key={equip.id} value={equip.id} onSelect={() => handleAddEquipment(equip)} className="cursor-pointer py-2.5 hover:bg-accent">
                                      <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                                        <Package className="h-4 w-4" />
                                      </div>
                                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="truncate font-medium">{equip.name}</span>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                          <span>Patrimônio: {equip.patrimony_code}</span>
                                          {equip.quantity > 1 ? (
                                            <span className="font-medium text-primary">{equip.available_quantity} disponível(is)</span>
                                          ) : (
                                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">Único</Badge>
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

                      {selectedItems.length === 0 ? (
                        <div className="mt-4 flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-border/55 bg-background/15 px-5 text-center">
                          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.06] text-primary/80">
                            <Package className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-medium">Nenhum equipamento adicionado</p>
                          <p className="mt-1 max-w-lg text-xs text-muted-foreground">Busque um patrimônio acima ou adicione um item avulso para iniciar o empréstimo.</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {selectedItems.map((item) => (
                            <div key={itemKey(item)} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-background/20 p-3 transition hover:border-primary/25 sm:flex-row sm:items-center">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                                  <Package className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{item.kind === 'inventory' ? item.equipment.name : item.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">{item.kind === 'inventory' ? `Patrimônio: ${item.equipment.patrimony_code}` : 'Item avulso'}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 sm:justify-end">
                                {item.kind === 'manual' || item.equipment.quantity > 1 ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.kind === 'inventory' ? item.equipment.available_quantity : undefined}
                                      value={item.quantity}
                                      onChange={(event) => handleQuantityChange(itemKey(item), parseInt(event.target.value) || 1)}
                                      className="h-8 w-20"
                                    />
                                    <span className="text-xs text-muted-foreground">{item.kind === 'inventory' ? `/ ${item.equipment.available_quantity}` : 'un.'}</span>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="border-primary/20 bg-primary/[0.05] text-xs">Patrimônio único</Badge>
                                )}
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRemoveEquipment(itemKey(item))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-5 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <UserCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold">Identificação do Responsável</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">Preencha os dados do solicitante e a finalidade do empréstimo.</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <FormField
                          control={form.control}
                          name="borrower_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Solicitante *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-10 rounded-xl bg-background/25">
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

                        <div className="grid gap-5 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="borrower_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome do Solicitante *</FormLabel>
                                <FormControl><Input placeholder="Nome completo" {...field} className="h-10 rounded-xl bg-background/25" /></FormControl>
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
                                  <FormControl><Input placeholder="Ex: TI, Administrativo" {...field} className="h-10 rounded-xl bg-background/25" /></FormControl>
                                ) : (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-10 rounded-xl bg-background/25"><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
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
                                <FormControl><Input placeholder="(00) 00000-0000" {...field} className="h-10 rounded-xl bg-background/25" /></FormControl>
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
                                    <SelectTrigger className="h-10 rounded-xl bg-background/25"><SelectValue placeholder="Selecione a finalidade" /></SelectTrigger>
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
                                <FormControl><DatePickerInput value={field.value} onChange={field.onChange} placeholder="Selecionar data" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {borrowerType === 'aluno' && (
                          <>
                            <Separator className="bg-border/40" />
                            <div className="rounded-xl border border-border/35 bg-background/18 p-3.5">
                              <div className="mb-4 flex items-center gap-2 text-sm">
                                <UserRound className="h-4 w-4 text-primary" />
                                <span className="font-medium">Autorização da retirada</span>
                                <span className="text-xs text-muted-foreground">· para alunos</span>
                              </div>
                              <div className="grid gap-5 md:grid-cols-2">
                                <FormField
                                  control={form.control}
                                  name="authorizer_name"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Nome do Autorizador</FormLabel>
                                      <FormControl><Input placeholder="Nome do professor/responsável" {...field} className="h-10 rounded-xl bg-background/25" /></FormControl>
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
                                      <FormControl><Input placeholder="E-mail ou telefone" {...field} className="h-10 rounded-xl bg-background/25" /></FormControl>
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
                              <FormControl><Textarea placeholder="Informações adicionais sobre o empréstimo..." rows={3} {...field} className="resize-none rounded-xl bg-background/25" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/45 bg-card/70 shadow-[0_24px_70px_-52px_hsl(var(--primary)/0.75)] backdrop-blur-xl">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold">Responsabilidade e Assinatura</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">Confirme as condições de uso e registre a assinatura do solicitante.</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/40 bg-background/20 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <FileText className="h-4 w-4 text-primary" />
                          Termo de Responsabilidade
                        </div>
                        <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                          <p>1- Se o equipamento for danificado ou inutilizado por emprego inadequado, mau uso, negligência ou extravio, a instituição cobrará do responsável pelo empréstimo o valor de um equipamento equivalente.</p>
                          <p>2- Em caso de dano, inutilização ou extravio do equipamento deverei comunicar imediatamente o setor de Recursos Didáticos.</p>
                          <p>3- Devolverei no prazo limite de até 01 (um) dia útil ao término da utilização, o(s) equipamento(s) completo(s) e em perfeito estado de conservação.</p>
                          <p>4- A não devolução do(s) equipamento(s) poderá acarretar em sanções administrativas.</p>
                          <p>5- Estando os equipamentos em minha posse, estarei sujeito a inspeções sem prévio aviso.</p>
                        </div>
                        <label htmlFor="accept-terms" className={cn('mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', acceptedTerms ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : 'border-border/40 bg-background/20 hover:border-primary/25')}>
                          <Checkbox id="accept-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} className="mt-0.5" />
                          <span className="text-sm">
                            <span className="block font-medium">Li e aceito o Termo de Responsabilidade</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">O aceite é obrigatório para concluir o empréstimo.</span>
                          </span>
                        </label>
                      </div>

                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.045] p-3 text-sm">
                        <span className="text-muted-foreground">Colaborador responsável: </span>
                        <span className="font-medium text-foreground">{profile?.full_name || 'Não identificado'}</span>
                      </div>

                      <div className="mt-5 border-t border-border/40 pt-5">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          <PenLine className="h-4 w-4 text-primary" />
                          Assinatura do Solicitante *
                        </Label>
                        <p className="mb-3 mt-1 text-xs text-muted-foreground">O solicitante deve assinar abaixo para confirmar a retirada dos equipamentos.</p>
                        <div className="overflow-hidden rounded-xl border border-border/45 bg-background/20 p-2">
                          <SignaturePad onSignatureChange={setSignature} height={150} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex flex-col-reverse gap-2 rounded-2xl border border-border/45 bg-card/65 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="ghost" onClick={() => navigate('/equipment/loans')} className="h-10 rounded-xl sm:min-w-28">
                      Cancelar
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="hidden text-xs text-muted-foreground lg:inline">Revise os dados antes de confirmar.</span>
                      <Button type="submit" disabled={isSubmitting || totalItems === 0 || !signature || !acceptedTerms} className="h-10 min-w-52 rounded-xl bg-gradient-to-r from-primary to-violet-600 shadow-[0_12px_34px_-16px_hsl(var(--primary)/0.95)] hover:opacity-95">
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Registrar {totalItems > 1 ? `${totalItems} Empréstimos` : 'Empréstimo'}</>}
                      </Button>
                    </div>
                  </div>
                </div>

                <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
                  <Card className="border-border/45 bg-card/75 shadow-[0_24px_70px_-48px_hsl(var(--primary)/0.8)] backdrop-blur-xl">
                    <CardContent className="p-4">
                      <div className="mb-4 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-semibold">Resumo do Empréstimo</h2>
                      </div>

                      <div className="space-y-2.5">
                        <SummaryItem icon={Package} label="Equipamentos selecionados" value={`${totalItems}`} caption={totalItems ? `${totalUnits} unidade(s) no total` : 'Nenhum equipamento adicionado'} accent={totalItems > 0} />
                        <SummaryItem icon={UserRound} label="Solicitante" value={borrowerName || borrowerTypeLabel(borrowerType)} caption={borrowerName ? `${borrowerTypeLabel(borrowerType)}${borrowerSector ? ` · ${borrowerSector}` : ''}` : 'Nome ainda não informado'} />
                        <SummaryItem icon={CalendarDays} label="Data prevista de devolução" value={formatDateLabel(expectedReturnDate)} caption={expectedReturnDate ? 'Prazo definido' : 'Não informada'} />
                        <SummaryItem icon={FileText} label="Finalidade" value={purpose || 'Não informada'} caption={purpose ? 'Finalidade definida' : 'Selecione a finalidade'} />
                      </div>

                      {selectedItems.length > 0 && (
                        <div className="mt-4 border-t border-border/35 pt-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Itens</p>
                          <div className="space-y-1.5">
                            {selectedItems.slice(0, 3).map(item => (
                              <div key={`summary-${itemKey(item)}`} className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate text-muted-foreground">{item.kind === 'inventory' ? item.equipment.name : item.name}</span>
                                <span className="shrink-0 font-medium tabular-nums">x{item.quantity}</span>
                              </div>
                            ))}
                            {selectedItems.length > 3 && <p className="text-[11px] text-primary">+ {selectedItems.length - 3} outro(s)</p>}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-primary/25 bg-primary/[0.05] backdrop-blur-xl">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <Info className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Importante</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Confirme os equipamentos, os dados do responsável e a data de devolução. O solicitante deve aceitar o termo e assinar no momento da retirada.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </aside>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </MainLayout>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  caption,
  accent = false,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/20 p-3">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', accent ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border/45 bg-muted/20 text-muted-foreground')}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{caption}</p>
        </div>
      </div>
    </div>
  );
}
