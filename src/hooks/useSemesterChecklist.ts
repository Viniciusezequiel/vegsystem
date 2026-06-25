import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CompetencyStatus = 'draft' | 'released' | 'blocked' | 'finished';
export type SemesterItemStatus =
  | 'pending_analysis'
  | 'pending_ticket'
  | 'ticket_opened'
  | 'in_maintenance'
  | 'waiting_parts'
  | 'completed'
  | 'written_off'
  | 'cancelled';
export type MaintenanceType = 'internal' | 'external';

export interface Competency {
  id: string;
  name: string;
  status: CompetencyStatus;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface SemesterChecklist {
  id: string;
  competency_id: string;
  room_id: string | null;
  room_name: string;
  room_code: string | null;
  campus: string | null;
  floor: string | null;
  responsible_id: string | null;
  responsible_name: string;
  checklist_date: string;
  general_observation: string | null;
  status: SemesterItemStatus;
  created_at: string;
  updated_at: string;
}

export interface SemesterItem {
  id: string;
  checklist_id: string;
  category: string;
  item_name: string;
  quantity: number;
  observation: string | null;
  maintenance_type: MaintenanceType | null;
  needs_ticket: boolean;
  needs_label: boolean;
  photo_url: string | null;
  status: SemesterItemStatus;
  ticket_number: string | null;
  ticket_opened_at: string | null;
  ticket_responsible: string | null;
  maintenance_done_at: string | null;
  closure_observation: string | null;
  closure_responsible: string | null;
  created_at: string;
  updated_at: string;
}

export interface FurnitureDetail {
  id: string;
  checklist_item_id: string;
  item_type: string;
  problem_type: string;
  quantity: number;
  maintenance_type: MaintenanceType | null;
  observation: string | null;
  status: SemesterItemStatus;
  created_at: string;
  updated_at: string;
}

export interface SemesterLabel {
  id: string;
  checklist_item_id: string | null;
  furniture_detail_id: string | null;
  competency_id: string | null;
  label_code: string;
  sequence_number: number;
  sequence_total: number;
  generated_by_name: string | null;
  generated_at: string;
}

// ============ COMPETENCIES ============
export function useCompetencies() {
  return useQuery({
    queryKey: ['semester-competencies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('semester_competencies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Competency[];
    },
  });
}

export function useReleasedCompetencies() {
  return useQuery({
    queryKey: ['semester-competencies', 'released'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('semester_competencies')
        .select('*')
        .eq('status', 'released')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Competency[];
    },
  });
}

export function useUpsertCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Competency> & { name: string }) => {
      const { data, error } = await supabase
        .from('semester_competencies')
        .upsert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-competencies'] }),
  });
}

export function useUpdateCompetencyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompetencyStatus }) => {
      const { error } = await supabase.from('semester_competencies').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-competencies'] }),
  });
}

export function useDeleteCompetency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('semester_competencies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-competencies'] }),
  });
}

// ============ CHECKLISTS ============
export function useSemesterChecklists(competencyId?: string) {
  return useQuery({
    queryKey: ['semester-checklists', competencyId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('semester_checklists').select('*').order('checklist_date', { ascending: false });
      if (competencyId) q = q.eq('competency_id', competencyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SemesterChecklist[];
    },
  });
}

export function useSemesterChecklist(id?: string) {
  return useQuery({
    queryKey: ['semester-checklist', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('semester_checklists').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as SemesterChecklist | null;
    },
    enabled: !!id,
  });
}

export function useCreateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SemesterChecklist> & { competency_id: string; room_name: string; responsible_name: string }) => {
      const { data, error } = await supabase
        .from('semester_checklists')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as SemesterChecklist;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-checklists'] }),
  });
}

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SemesterChecklist> }) => {
      const { error } = await supabase.from('semester_checklists').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['semester-checklists'] });
      qc.invalidateQueries({ queryKey: ['semester-checklist', vars.id] });
    },
  });
}

export function useDeleteChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('semester_checklists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-checklists'] }),
  });
}

// ============ ITEMS ============
export function useChecklistItems(checklistId?: string) {
  return useQuery({
    queryKey: ['semester-items', checklistId],
    queryFn: async () => {
      if (!checklistId) return [];
      const { data, error } = await supabase
        .from('semester_checklist_items')
        .select('*')
        .eq('checklist_id', checklistId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SemesterItem[];
    },
    enabled: !!checklistId,
  });
}

export function useAllItems(competencyId?: string) {
  return useQuery({
    queryKey: ['semester-items-all', competencyId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('semester_checklist_items').select('*, semester_checklists!inner(*)');
      if (competencyId) q = q.eq('semester_checklists.competency_id', competencyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SemesterItem> & { checklist_id: string; category: string; item_name: string }) => {
      const { data, error } = await supabase
        .from('semester_checklist_items')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as SemesterItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semester-items'] });
      qc.invalidateQueries({ queryKey: ['semester-items-all'] });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SemesterItem> }) => {
      const { error } = await supabase.from('semester_checklist_items').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semester-items'] });
      qc.invalidateQueries({ queryKey: ['semester-items-all'] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('semester_checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semester-items'] });
      qc.invalidateQueries({ queryKey: ['semester-items-all'] });
    },
  });
}

// ============ FURNITURE ============
export function useFurnitureDetails(itemId?: string) {
  return useQuery({
    queryKey: ['semester-furniture', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await supabase
        .from('semester_furniture_details')
        .select('*')
        .eq('checklist_item_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FurnitureDetail[];
    },
    enabled: !!itemId,
  });
}

export function useAllFurniture(competencyId?: string) {
  return useQuery({
    queryKey: ['semester-furniture-all', competencyId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('semester_furniture_details')
        .select('*, semester_checklist_items!inner(*, semester_checklists!inner(*))');
      if (competencyId) q = q.eq('semester_checklist_items.semester_checklists.competency_id', competencyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateFurniture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FurnitureDetail> & { checklist_item_id: string; item_type: string; problem_type: string }) => {
      const { data, error } = await supabase
        .from('semester_furniture_details')
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data as FurnitureDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semester-furniture'] });
      qc.invalidateQueries({ queryKey: ['semester-furniture-all'] });
    },
  });
}

export function useDeleteFurniture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('semester_furniture_details').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['semester-furniture'] });
      qc.invalidateQueries({ queryKey: ['semester-furniture-all'] });
    },
  });
}

// ============ LABELS ============
export function useCompetencyLabels(competencyId?: string) {
  return useQuery({
    queryKey: ['semester-labels', competencyId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('semester_labels').select('*').order('generated_at', { ascending: false });
      if (competencyId) q = q.eq('competency_id', competencyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SemesterLabel[];
    },
  });
}

export function useCreateLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Partial<SemesterLabel>[]) => {
      const { data, error } = await supabase.from('semester_labels').insert(rows as any).select();
      if (error) throw error;
      return (data ?? []) as SemesterLabel[];
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-labels'] }),
  });
}

// ===== Item options (admin pre-cadastra opções do dropdown por categoria) =====
export interface SemesterItemOption {
  id: string;
  category: string;
  label: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useItemOptions() {
  return useQuery({
    queryKey: ['semester-item-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('semester_item_options' as any)
        .select('*')
        .order('category')
        .order('sort_order')
        .order('label');
      if (error) throw error;
      return (data ?? []) as unknown as SemesterItemOption[];
    },
  });
}

export function useCreateItemOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { category: string; label: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from('semester_item_options' as any)
        .insert(row as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-item-options'] }),
  });
}

export function useDeleteItemOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('semester_item_options' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['semester-item-options'] }),
  });
}
