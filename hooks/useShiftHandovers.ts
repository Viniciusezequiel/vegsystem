import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ShiftHandover = {
  id: string;
  shift: string;
  day_of_week: string;
  handover_date: string;
  sector: string;
  unit: string;
  has_impact_incident: boolean;
  general_observations: string | null;
  collaborator_name: string;
  collaborator_time: string;
  filled_by: string;
  filled_at: string;
  created_at: string;
};

export type ShiftHandoverTask = {
  id: string;
  handover_id: string;
  task_name: string;
  answer: boolean;
  observation: string | null;
};

export type ShiftHandoverIncident = {
  id: string;
  handover_id: string;
  incident_type: string;
  description: string | null;
  location: string | null;
  treatment: string | null;
};

export type ShiftHandoverWithDetails = ShiftHandover & {
  tasks: ShiftHandoverTask[];
  incidents: ShiftHandoverIncident[];
};

export function useShiftHandovers(filters?: { shift?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['shift-handovers', filters],
    queryFn: async () => {
      let query = supabase
        .from('shift_handovers')
        .select('*')
        .order('handover_date', { ascending: false })
        .order('filled_at', { ascending: false });

      if (filters?.shift && filters.shift !== 'all') {
        query = query.eq('shift', filters.shift);
      }
      if (filters?.dateFrom) {
        query = query.gte('handover_date', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('handover_date', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ShiftHandover[];
    },
  });
}

export function useShiftHandoverDetail(handoverId: string) {
  return useQuery({
    queryKey: ['shift-handover-detail', handoverId],
    queryFn: async () => {
      const [handoverRes, tasksRes, incidentsRes] = await Promise.all([
        supabase.from('shift_handovers').select('*').eq('id', handoverId).single(),
        supabase.from('shift_handover_tasks').select('*').eq('handover_id', handoverId).order('id'),
        supabase.from('shift_handover_incidents').select('*').eq('handover_id', handoverId).order('id'),
      ]);

      if (handoverRes.error) throw handoverRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (incidentsRes.error) throw incidentsRes.error;

      return {
        ...handoverRes.data,
        tasks: tasksRes.data,
        incidents: incidentsRes.data,
      } as ShiftHandoverWithDetails;
    },
    enabled: !!handoverId,
  });
}

export function useCreateShiftHandover() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      shift: string;
      day_of_week: string;
      handover_date: string;
      sector: string;
      unit: string;
      has_impact_incident: boolean;
      general_observations?: string;
      collaborator_name: string;
      collaborator_time: string;
      tasks: { task_name: string; answer: boolean; observation?: string }[];
      incidents: { incident_type: string; description?: string; location?: string; treatment?: string }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Create handover
      const { data: handover, error: handoverError } = await supabase
        .from('shift_handovers')
        .insert({
          shift: data.shift,
          day_of_week: data.day_of_week,
          handover_date: data.handover_date,
          sector: data.sector,
          unit: data.unit,
          has_impact_incident: data.has_impact_incident,
          general_observations: data.general_observations || null,
          collaborator_name: data.collaborator_name,
          collaborator_time: data.collaborator_time,
          filled_by: user.id,
        })
        .select()
        .single();

      if (handoverError) throw handoverError;

      // Create tasks
      if (data.tasks.length > 0) {
        const tasksToInsert = data.tasks.map(t => ({
          handover_id: handover.id,
          task_name: t.task_name,
          answer: t.answer,
          observation: t.observation || null,
        }));

        const { error: tasksError } = await supabase
          .from('shift_handover_tasks')
          .insert(tasksToInsert);

        if (tasksError) throw tasksError;
      }

      // Create incidents (only non-empty ones)
      const validIncidents = data.incidents.filter(i => i.description || i.location);
      if (validIncidents.length > 0) {
        const incidentsToInsert = validIncidents.map(i => ({
          handover_id: handover.id,
          incident_type: i.incident_type,
          description: i.description || null,
          location: i.location || null,
          treatment: i.treatment || null,
        }));

        const { error: incidentsError } = await supabase
          .from('shift_handover_incidents')
          .insert(incidentsToInsert);

        if (incidentsError) throw incidentsError;
      }

      return handover;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-handovers'] });
      toast.success('Passagem de plantão registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar passagem: ' + error.message);
    },
  });
}
