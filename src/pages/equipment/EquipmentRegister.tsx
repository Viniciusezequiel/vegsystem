import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Package, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateEquipment, useUpdateEquipment, useEquipment } from '@/hooks/useEquipment';

const equipmentSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  patrimony_code: z.string().optional(),
  old_patrimony_code: z.string().optional(),
  patrimony_type: z.enum(['unique', 'quantity']),
  quantity: z.coerce.number().min(1, 'Quantidade mínima é 1'),
  location: z.string().min(1, 'Local é obrigatório'),
  campus: z.enum(['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm']),
  category: z.string().optional(),
  description: z.string().optional(),
}).refine((data) => {
  if (data.patrimony_type === 'unique') {
    return !!data.patrimony_code && data.patrimony_code.trim().length > 0;
  }
  return true;
}, {
  message: 'Número do patrimônio é obrigatório para patrimônio único',
  path: ['patrimony_code'],
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
      old_patrimony_code: '',
      patrimony_type: 'unique',
      quantity: 1,
      location: '',
      campus: 'Campus I',
      category: '',
      description: '',
    },
  });

  const patrimonyType = form.watch('patrimony_type');

  // When patrimony type changes to unique, force quantity to 1
  useEffect(() => {
    if (patrimonyType === 'unique') {
      form.setValue('quantity', 1);
    }
  }, [patrimonyType, form]);

  // Populate form when editing
  useEffect(() => {
    if (existingEquipment && isEditing) {
      const isUnique = existingEquipment.quantity === 1;
      form.reset({
        name: existingEquipment.name,
        patrimony_code: existingEquipment.patrimony_code,
        old_patrimony_code: existingEquipment.old_patrimony_code || '',
        patrimony_type: isUnique ? 'unique' : 'quantity',
        quantity: existingEquipment.quantity,
        location: existingEquipment.location,
        campus: existingEquipment.campus,
        category: existingEquipment.category || '',
        description: existingEquipment.description || '',
      });
    }
  }, [existingEquipment, isEditing, form]);

  const onSubmit = async (data: EquipmentFormData) => {
    const finalQuantity = data.patrimony_type === 'unique' ? 1 : data.quantity;
    const finalPatrimonyCode = data.patrimony_type === 'quantity' 
      ? `QTD-${Date.now().toString(36).toUpperCase()}`
      : data.patrimony_code || '';
    
    if (isEditing && id) {
      await updateEquipment.mutateAsync({
        id,
        name: data.name,
        patrimony_code: data.patrimony_type === 'unique' ? (data.patrimony_code || '') : existingEquipment?.patrimony_code || finalPatrimonyCode,
        quantity: finalQuantity,
        location: data.location,
        campus: data.campus,
        category: data.category || null,
        description: data.description || null,
        allow_external_loan: false,
      });
    } else {
      await createEquipment.mutateAsync({
        name: data.name,
        patrimony_code: finalPatrimonyCode,
        quantity: finalQuantity,
        location: data.location,
        campus: data.campus,
        available_quantity: finalQuantity,
        status: 'available',
        image_url: null,
        category: data.category || null,
        description: data.description || null,
        allow_external_loan: false,
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

                {/* Patrimony Type Selection */}
                <FormField
                  control={form.control}
                  name="patrimony_type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Tipo de Controle *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col sm:flex-row gap-4"
                        >
                          <div className="flex items-center space-x-2 rounded-md border p-3 flex-1 cursor-pointer hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="unique" id="unique" />
                            <Label htmlFor="unique" className="cursor-pointer flex-1">
                              <span className="font-medium">Patrimônio Único</span>
                              <p className="text-xs text-muted-foreground">Item individual com patrimônio exclusivo (quantidade fixa = 1)</p>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 rounded-md border p-3 flex-1 cursor-pointer hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="quantity" id="quantity" />
                            <Label htmlFor="quantity" className="cursor-pointer flex-1">
                              <span className="font-medium">Por Quantidade</span>
                              <p className="text-xs text-muted-foreground">Item com múltiplas unidades disponíveis para empréstimo</p>
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Patrimony code - only for unique type */}
                {patrimonyType === 'unique' && (
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
                )}

                {/* Quantity field - only visible when type is 'quantity' */}
                {patrimonyType === 'quantity' && (
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade Disponível *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Informe a quantidade total de unidades disponíveis para empréstimo
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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