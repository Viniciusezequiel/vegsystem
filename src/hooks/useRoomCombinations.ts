import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface RoomCombination {
  id: string;
  parent_room_id: string;
  linked_room_id: string;
  created_at: string;
}

export function useRoomCombinations() {
  return useQuery({
    queryKey: ['room-combinations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_combinations')
        .select('*');
      
      if (error) throw error;
      return data as RoomCombination[];
    },
  });
}

export function useCreateRoomCombination() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { parent_room_id: string; linked_room_id: string }) => {
      const { data: combination, error } = await supabase
        .from('room_combinations')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return combination;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-combinations'] });
      toast({
        title: 'Combinação criada',
        description: 'As salas foram vinculadas com sucesso.',
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

export function useDeleteRoomCombination() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_combinations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-combinations'] });
      toast({
        title: 'Combinação removida',
        description: 'O vínculo entre as salas foi removido.',
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

export function useBulkCreateRoomCombinations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { parent_room_id: string; linked_room_ids: string[] }) => {
      const insertData = data.linked_room_ids.map((linked_room_id) => ({
        parent_room_id: data.parent_room_id,
        linked_room_id,
      }));

      const { data: combinations, error } = await supabase
        .from('room_combinations')
        .insert(insertData)
        .select();

      if (error) throw error;
      return combinations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-combinations'] });
      toast({
        title: 'Combinações criadas',
        description: 'As salas foram vinculadas com sucesso.',
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
