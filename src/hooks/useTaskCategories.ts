import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskCategoryConfig {
  name: string;
  requiredFields: string[];
}

const AVAILABLE_FIELDS = [
  { key: 'description', label: 'Descrição' },
  { key: 'due_date', label: 'Prazo' },
  { key: 'assigned_to', label: 'Responsável' },
  { key: 'notes', label: 'Observações' },
  { key: 'event_datetime', label: 'Data/Horário do Evento' },
];

export { AVAILABLE_FIELDS };

const DEFAULT_CATEGORIES: TaskCategoryConfig[] = [
  { name: 'Acompanhamento', requiredFields: ['assigned_to', 'event_datetime'] },
  { name: 'Manutenção', requiredFields: [] },
  { name: 'TI', requiredFields: [] },
  { name: 'RH', requiredFields: [] },
  { name: 'Administrativo', requiredFields: [] },
  { name: 'Limpeza', requiredFields: [] },
  { name: 'Segurança', requiredFields: [] },
  { name: 'Outro', requiredFields: [] },
];

export function useTaskCategories() {
  return useQuery({
    queryKey: ['task-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'task_categories')
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_CATEGORIES;

      const value = data.value as unknown as { categories: TaskCategoryConfig[] | string[] };
      
      if (!value.categories?.length) return DEFAULT_CATEGORIES;

      // Backward compatibility: if categories are strings, convert
      if (typeof value.categories[0] === 'string') {
        return (value.categories as string[]).map(name => ({
          name,
          requiredFields: name.toLowerCase() === 'acompanhamento' ? ['assigned_to', 'event_datetime'] : [],
        }));
      }

      return value.categories as TaskCategoryConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Helper to get just category names (for dropdowns)
export function useTaskCategoryNames() {
  const { data: categories, ...rest } = useTaskCategories();
  return {
    ...rest,
    data: categories?.map(c => c.name),
  };
}

export function useUpdateTaskCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (categories: TaskCategoryConfig[]) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'task_categories')
        .maybeSingle();

      const value = { categories } as unknown as Record<string, never>;

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value })
          .eq('key', 'task_categories');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: 'task_categories',
            value,
            description: 'Categorias disponíveis para demandas',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-categories'] });
      toast({ title: 'Categorias atualizadas', description: 'As categorias foram salvas com sucesso.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}
