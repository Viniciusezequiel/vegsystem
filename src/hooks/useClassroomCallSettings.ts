import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ClassroomCallRoom {
  id: string;
  name: string;
  campus: string;
  is_active: boolean;
  created_at: string;
  issues?: ClassroomCallRoomIssue[];
}

export interface ClassroomCallRoomIssue {
  id: string;
  room_id: string;
  description: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface ClassroomCallResponse {
  id: string;
  message: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

// ---- Rooms ----
export function useClassroomCallRooms(activeOnly = false) {
  return useQuery({
    queryKey: ['classroom-call-rooms', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('classroom_call_rooms')
        .select('*')
        .order('name');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ClassroomCallRoom[];
    },
  });
}

export function useCreateClassroomCallRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; campus: string }) => {
      const { error } = await supabase
        .from('classroom_call_rooms')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-rooms'] });
      toast({ title: 'Sala cadastrada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateClassroomCallRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; campus?: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from('classroom_call_rooms')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-rooms'] });
      toast({ title: 'Sala atualizada' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteClassroomCallRoom() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classroom_call_rooms')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-rooms'] });
      toast({ title: 'Sala removida' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

// ---- Room Issues ----
export function useClassroomCallRoomIssues(roomId?: string) {
  return useQuery({
    queryKey: ['classroom-call-room-issues', roomId],
    queryFn: async () => {
      let query = supabase
        .from('classroom_call_room_issues')
        .select('*')
        .order('order_index');
      
      if (roomId) {
        query = query.eq('room_id', roomId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ClassroomCallRoomIssue[];
    },
    enabled: roomId !== undefined,
  });
}

export function useCreateClassroomCallRoomIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { room_id: string; description: string; order_index?: number }) => {
      const { error } = await supabase
        .from('classroom_call_room_issues')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-room-issues'] });
      toast({ title: 'Problema cadastrado' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateClassroomCallRoomIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; description?: string; is_active?: boolean; order_index?: number }) => {
      const { error } = await supabase
        .from('classroom_call_room_issues')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-room-issues'] });
    },
  });
}

export function useDeleteClassroomCallRoomIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classroom_call_room_issues')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-room-issues'] });
      toast({ title: 'Problema removido' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

// ---- Responses ----
export function useClassroomCallResponses(activeOnly = false) {
  return useQuery({
    queryKey: ['classroom-call-responses', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('classroom_call_responses')
        .select('*')
        .order('order_index');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ClassroomCallResponse[];
    },
  });
}

export function useCreateClassroomCallResponse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { message: string; order_index?: number }) => {
      const { error } = await supabase
        .from('classroom_call_responses')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-responses'] });
      toast({ title: 'Resposta cadastrada' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateClassroomCallResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; message?: string; is_active?: boolean; order_index?: number }) => {
      const { error } = await supabase
        .from('classroom_call_responses')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-responses'] });
    },
  });
}

export function useDeleteClassroomCallResponse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('classroom_call_responses')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classroom-call-responses'] });
      toast({ title: 'Resposta removida' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });
}
