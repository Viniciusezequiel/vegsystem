import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type LabelField = {
  id: string;
  name: string;
  column: string; // planilha column name
  x: number; // mm
  y: number; // mm
  width: number; // mm
  fontSize: number; // pt
  fontFamily: 'helvetica' | 'times' | 'courier';
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  wrap: boolean;
  lineHeight: number;
  color: string; // hex
};

export type LabelTemplate = {
  id: string;
  user_id: string;
  name: string;
  page_size: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  page_margin_top: number;
  page_margin_bottom: number;
  page_margin_left: number;
  page_margin_right: number;
  label_width: number;
  label_height: number;
  columns: number;
  rows: number;
  horizontal_gap: number;
  vertical_gap: number;
  fields: LabelField[];
  created_at: string;
  updated_at: string;
};

export const useLabelTemplates = () => {
  return useQuery({
    queryKey: ['label_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_templates' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LabelTemplate[];
    },
  });
};

export const useLabelTemplate = (id: string | undefined) => {
  return useQuery({
    queryKey: ['label_templates', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('label_templates' as any)
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LabelTemplate | null;
    },
  });
};

export const useSaveLabelTemplate = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tpl: Partial<LabelTemplate> & { id?: string }) => {
      if (tpl.id) {
        const { id, created_at, updated_at, user_id, ...rest } = tpl as any;
        const { data, error } = await supabase
          .from('label_templates' as any)
          .update(rest)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('label_templates' as any)
          .insert({ ...tpl, user_id: user?.id } as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['label_templates'] });
    },
  });
};

export const useDeleteLabelTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('label_templates' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['label_templates'] }),
  });
};
