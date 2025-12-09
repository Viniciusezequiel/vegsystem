import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Package } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEquipmentList, useCreateEquipmentLoan } from '@/hooks/useEquipment';

const loanSchema = z.object({
  equipment_id: z.string().min(1, 'Selecione um equipamento'),
  quantity_borrowed: z.coerce.number().min(1, 'Quantidade mínima é 1'),
  borrower_name: z.string().min(1, 'Nome é obrigatório'),
  borrower_sector: z.string().min(1, 'Setor é obrigatório'),
  borrower_phone: z.string().min(1, 'Telefone é obrigatório'),
  expected_return_date: z.string().min(1, 'Data de devolução é obrigatória'),
  notes: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function EquipmentLoanForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedEquipment = searchParams.get('equipment') || '';
  
  const { data: equipment } = useEquipmentList();
  const createLoan = useCreateEquipmentLoan();

  const availableEquipment = equipment?.filter(e => e.available_quantity > 0);

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      equipment_id: preselectedEquipment,
      quantity_borrowed: 1,
      borrower_name: '',
      borrower_sector: '',
      borrower_phone: '',
      expected_return_date: '',
      notes: '',
    },
  });

  const selectedEquipmentId = form.watch('equipment_id');
  const selectedEquipment = equipment?.find(e => e.id === selectedEquipmentId);
  const maxQuantity = selectedEquipment?.available_quantity || 1;

  const onSubmit = async (data: LoanFormData) => {
    await createLoan.mutateAsync({
      equipment_id: data.equipment_id,
      quantity_borrowed: data.quantity_borrowed,
      borrower_name: data.borrower_name,
      borrower_sector: data.borrower_sector,
      borrower_phone: data.borrower_phone,
      expected_return_date: data.expected_return_date,
      notes: data.notes || undefined,
    });
    navigate('/equipment/loans');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/equipment/loans')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Empréstimo</h1>
            <p className="text-muted-foreground">Registre um empréstimo de equipamento</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dados do Empréstimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="equipment_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equipamento *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o equipamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableEquipment?.map((equip) => (
                              <SelectItem key={equip.id} value={equip.id}>
                                {equip.name} ({equip.patrimony_code}) - {equip.available_quantity} disponível(eis)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity_borrowed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={maxQuantity}
                            {...field} 
                          />
                        </FormControl>
                        {selectedEquipment && (
                          <p className="text-xs text-muted-foreground">
                            Máximo disponível: {maxQuantity}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                          <Input type="date" {...field} />
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

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/equipment/loans')}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createLoan.isPending}>
                    {createLoan.isPending ? 'Registrando...' : 'Registrar Empréstimo'}
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
