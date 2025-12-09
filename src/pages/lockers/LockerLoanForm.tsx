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
import { ArrowLeft, Box } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLockersList, useCreateLockerLoan } from '@/hooks/useLockers';

const loanSchema = z.object({
  locker_id: z.string().min(1, 'Selecione um escaninho'),
  borrower_name: z.string().min(1, 'Nome é obrigatório'),
  borrower_phone: z.string().min(1, 'Telefone é obrigatório'),
  borrower_email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  borrower_sector: z.string().optional(),
  expected_return_date: z.string().min(1, 'Data de devolução é obrigatória'),
  notes: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function LockerLoanForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedLocker = searchParams.get('locker') || '';
  
  const { data: lockers } = useLockersList('available');
  const createLoan = useCreateLockerLoan();

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      locker_id: preselectedLocker,
      borrower_name: '',
      borrower_phone: '',
      borrower_email: '',
      borrower_sector: '',
      expected_return_date: '',
      notes: '',
    },
  });

  const onSubmit = async (data: LoanFormData) => {
    await createLoan.mutateAsync({
      locker_id: data.locker_id,
      borrower_name: data.borrower_name,
      borrower_phone: data.borrower_phone,
      borrower_email: data.borrower_email,
      borrower_sector: data.borrower_sector || undefined,
      expected_return_date: data.expected_return_date,
      notes: data.notes || undefined,
    });
    navigate('/lockers/loans');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lockers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Empréstimo de Escaninho</h1>
            <p className="text-muted-foreground">Registre um empréstimo de escaninho</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Dados do Empréstimo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="locker_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Escaninho *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o escaninho" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lockers?.map((locker) => (
                              <SelectItem key={locker.id} value={locker.id}>
                                {locker.code} - {locker.campus} - {locker.location}
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
                    name="borrower_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Cliente *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
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
                    name="borrower_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="cliente@email.com" {...field} />
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
                        <FormLabel>Setor</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Administrativo" {...field} />
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
                          placeholder="Informações adicionais..."
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
                    onClick={() => navigate('/lockers')}
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
