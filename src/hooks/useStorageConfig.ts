import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BoxConfig {
  id: string;
  label: string; // e.g. "20", "21"
}

export interface ShelfConfig {
  id: string;
  code: string; // e.g. "1.3"
  label: string; // e.g. "Variados"
  boxes: BoxConfig[];
}

export interface CampusStorageConfig {
  campus: string;
  shelves: ShelfConfig[];
}

export interface StorageConfigData {
  campuses: CampusStorageConfig[];
}

const SETTING_KEY = 'lost_items_storage_config';

export function useStorageConfig() {
  return useQuery({
    queryKey: ['storage-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return getDefaultConfig();
      }

      return (data.value as unknown as StorageConfigData) || getDefaultConfig();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateStorageConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: StorageConfigData) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: config as unknown as Record<string, never> })
          .eq('key', SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({
            key: SETTING_KEY,
            value: config as unknown as Record<string, never>,
            description: 'Configuração de estantes, prateleiras e caixas por campus',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-config'] });
      toast({
        title: 'Configuração salva',
        description: 'A configuração de armazenamento foi atualizada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

function getDefaultConfig(): StorageConfigData {
  return {
    campuses: [
      {
        campus: 'Campus I',
        shelves: [
          { id: '1', code: '1.3', label: 'Variados', boxes: [{ id: '1', label: '20' }, { id: '2', label: '21' }] },
          { id: '2', code: '1.4', label: 'Necessaire e lancheira', boxes: [{ id: '1', label: '15' }] },
          { id: '3', code: '1.5', label: 'Vasilhas/Jalecos e pijamas', boxes: [{ id: '1', label: '16' }, { id: '2', label: '17' }] },
          { id: '4', code: '1.6', label: 'Variados', boxes: [{ id: '1', label: '18' }, { id: '2', label: '19' }] },
          { id: '5', code: '2.3', label: 'Sombrinhas', boxes: [] },
          { id: '6', code: '2.4', label: 'Necessaire e Lancheiras', boxes: [] },
          { id: '7', code: '2.5', label: 'Roupas', boxes: [] },
          { id: '8', code: '2.6', label: 'Roupas', boxes: [] },
          { id: '9', code: '3.3', label: 'Pequenos pertences e eletrônicos', boxes: [] },
          { id: '10', code: '3.4', label: 'Material acadêmico', boxes: [] },
          { id: '11', code: '3.5', label: 'Garrafas e copos', boxes: [] },
          { id: '12', code: '3.6', label: 'Garrafas e copos', boxes: [] },
          { id: '13', code: '9.1', label: 'Documentos pessoais e pertences de valor', boxes: [] },
        ],
      },
    ],
  };
}
