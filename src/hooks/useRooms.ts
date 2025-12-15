import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RoomChecklistItem = {
  id: string;
  label: string;
};

export type Room = {
  id: string;
  name: string;
  campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
  building: string;
  floor: string | null;
  capacity: number | null;
  description: string | null;
  checklist_items: RoomChecklistItem[];
  created_at: string;
  updated_at: string;
};

export type ChecklistQuestion = {
  id: string;
  question: string;
  category: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
};

export type RoomChecklist = {
  id: string;
  room_id: string;
  filled_by: string;
  shift: string;
  observations: string | null;
  filled_at: string;
  room?: Room;
  answers?: ChecklistAnswer[];
  profile?: { full_name: string };
};

export type ChecklistAnswer = {
  id: string;
  checklist_id: string;
  question_id: string;
  answer: boolean;
  notes: string | null;
  question?: ChecklistQuestion;
};

export function useRoomsList() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Room[];
    },
  });
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: ['room', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Room | null;
    },
    enabled: !!id,
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (room: Omit<Room, 'id' | 'created_at' | 'updated_at' | 'checklist_items'> & { checklist_items?: RoomChecklistItem[] }) => {
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          ...room,
          checklist_items: room.checklist_items || [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Sala cadastrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar sala: ' + error.message);
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...room }: Partial<Omit<Room, 'checklist_items'>> & { id: string; checklist_items?: RoomChecklistItem[] }) => {
      const { data, error } = await supabase
        .from('rooms')
        .update(room as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Sala atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar sala: ' + error.message);
    },
  });
}

export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rooms').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Sala excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir sala: ' + error.message);
    },
  });
}

export function useChecklistQuestions() {
  return useQuery({
    queryKey: ['checklist-questions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_questions')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return data as ChecklistQuestion[];
    },
  });
}

export function useRoomChecklists(roomId?: string) {
  return useQuery({
    queryKey: ['room-checklists', roomId],
    queryFn: async () => {
      let query = supabase
        .from('room_checklists')
        .select(`
          *,
          room:rooms(*)
        `)
        .order('filled_at', { ascending: false });

      if (roomId) {
        query = query.eq('room_id', roomId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RoomChecklist[];
    },
  });
}

export function useChecklistWithAnswers(checklistId: string) {
  return useQuery({
    queryKey: ['checklist-detail', checklistId],
    queryFn: async () => {
      const { data: checklist, error: checklistError } = await supabase
        .from('room_checklists')
        .select(`
          *,
          room:rooms(*)
        `)
        .eq('id', checklistId)
        .single();
      
      if (checklistError) throw checklistError;

      const { data: answers, error: answersError } = await supabase
        .from('checklist_answers')
        .select('*, question:checklist_questions(*)')
        .eq('checklist_id', checklistId);
      
      if (answersError) throw answersError;

      return { ...checklist, answers } as RoomChecklist;
    },
    enabled: !!checklistId,
  });
}

export function useCreateChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      room_id: string;
      shift: string;
      observations?: string;
      answers: { question_id: string; answer: boolean; notes?: string }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('room_checklists')
        .insert({
          room_id: data.room_id,
          filled_by: user.id,
          shift: data.shift,
          observations: data.observations,
        })
        .select()
        .single();
      
      if (checklistError) throw checklistError;

      // Create answers
      const answersToInsert = data.answers.map(a => ({
        checklist_id: checklist.id,
        question_id: a.question_id,
        answer: a.answer,
        notes: a.notes,
      }));

      const { error: answersError } = await supabase
        .from('checklist_answers')
        .insert(answersToInsert);
      
      if (answersError) throw answersError;

      return checklist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-checklists'] });
      toast.success('Checklist salvo com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar checklist: ' + error.message);
    },
  });
}
