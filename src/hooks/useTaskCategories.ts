import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_CATEGORIES = [
  'Acompanhamento',
  'Manutenção',
  'TI',
  'RH',
  'Administrativo',
  'Limpeza',
  'Segurança',
  'Outro',
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

      const value = data.value as unknown as { categories: string[] };
      return value.categories?.length ? value.categories : DEFAULT_CATEGORIES;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTaskCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (categories: string[]) => {
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
