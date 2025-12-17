import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateEquipment, useUpdateEquipment, useEquipment } from '@/hooks/useEquipment';

const equipmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  patrimony_code: z.string().min(1, 'Número do patrimônio é obrigatório'),
  quantity: z.coerce.number().min(1, 'Quantidade mínima é 1'),
  location: z.string().min(1, 'Local é obrigatório'),
  campus: z.enum(['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm']),
  category: z.string().optional(),
  description: z.string().optional(),
  allow_external_loan: z.boolean().default(true),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

export default function EquipmentRegister() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  
  const { data: existingEquipment, isLoading: loadingEquipment } = useEquipment(id || '');
  const createEquipment = useCreateEquipment();
  const updateEquipment = useUpdateEquipment();

  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      name: '',
      patrimony_code: '',
      quantity: 1,
      location: '',
      campus: 'Campus I',
      category: '',
      description: '',
      allow_external_loan: true,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingEquipment && isEditing) {
      form.reset({
        name: existingEquipment.name,
        patrimony_code: existingEquipment.patrimony_code,
        quantity: existingEquipment.quantity,
        location: existingEquipment.location,
        campus: existingEquipment.campus,
        category: existingEquipment.category || '',
        description: existingEquipment.description || '',
        allow_external_loan: existingEquipment.allow_external_loan,
      });
    }
  }, [existingEquipment, isEditing, form]);

  const onSubmit = async (data: EquipmentFormData) => {
    if (isEditing && id) {
      await updateEquipment.mutateAsync({
        id,
        name: data.name,
        patrimony_code: data.patrimony_code,
        quantity: data.quantity,
        location: data.location,
        campus: data.campus,
        category: data.category || null,
        description: data.description || null,
        allow_external_loan: data.allow_external_loan,
      });
    } else {
      await createEquipment.mutateAsync({
        name: data.name,
        patrimony_code: data.patrimony_code,
        quantity: data.quantity,
        location: data.location,
        campus: data.campus,
        available_quantity: data.quantity,
        status: 'available',
        image_url: null,
        category: data.category || null,
        description: data.description || null,
        allow_external_loan: data.allow_external_loan,
      });
    }
    navigate('/equipment');
  };

  const isPending = createEquipment.isPending || updateEquipment.isPending;

  if (isEditing && loadingEquipment) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/equipment')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? 'Editar Equipamento' : 'Cadastrar Equipamento'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Atualize as informações do equipamento' : 'Adicione um novo item ao inventário'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informações do Equipamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Equipamento *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Projetor Epson" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="patrimony_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número do Patrimônio *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: PAT-2024-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            {...field} 
                            disabled={isEditing && existingEquipment?.quantity === 1}
                          />
                        </FormControl>
                        <FormMessage />
                        {isEditing && existingEquipment?.quantity === 1 && (
                          <p className="text-xs text-muted-foreground">
                            Item com patrimônio único não pode ter quantidade alterada
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Eletrônicos, Mobiliário" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="campus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campus *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o campus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Campus I">Campus I</SelectItem>
                            <SelectItem value="Campus II">Campus II</SelectItem>
                            <SelectItem value="Campus IV">Campus IV</SelectItem>
                            <SelectItem value="Campus HUCM Adm">Campus HUCM Adm</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local de Alocação *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Sala 101, Bloco A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Informações adicionais sobre o equipamento..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allow_external_loan"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Permitir empréstimo externo</FormLabel>
                        <FormDescription>
                          Quando marcado, este equipamento pode ser solicitado por usuários externos
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/equipment')}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Equipamento'}
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
