import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type LabLoanItem = {
  id: string;
  lab_loan_id: string;
  item_type: 'locker' | 'equipment' | 'manual';
  locker_id: string | null;
  equipment_id: string | null;
  manual_item_name: string | null;
  quantity: number;
  usage_mode: 'lab_use' | 'removal';
  active: boolean;
  locker?: { id: string; code: string; campus: string; location: string } | null;
  equipment?: { id: string; name: string; patrimony_code: string | null } | null;
};

export type LabLoan = {
  id: string;
  borrower_name: string;
  borrower_sector: string;
  borrower_phone: string | null;
  activity_type: 'aula' | 'monitoria' | 'tcc' | 'coleta' | 'iniciacao_cientifica' | 'outra';
  activity_other: string | null;
  shift: 'manha' | 'tarde' | 'noite';
  status: 'active' | 'returned' | 'cancelled';
  borrower_signature: string | null;
  return_signature: string | null;
  notes: string | null;
  loaned_by: string | null;
  returned_by: string | null;
  returned_at: string | null;
  manual_close_reason: string | null;
  created_at: string;
  updated_at: string;
  items: LabLoanItem[];
};

export function useLabLoans() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`lab-loans-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_loans' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lab-loans'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_loan_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lab-loans'] });
        queryClient.invalidateQueries({ queryKey: ['lab-available-lockers'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['lab-loans'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lab_loans')
        .select(`
          *,
          items:lab_loan_items(
            *,
            locker:lockers(id,code,campus,location),
            equipment:equipment(id,name,patrimony_code)
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LabLoan[];
    },
  });
}

export function useAvailableLabLockers() {
  return useQuery({
    queryKey: ['lab-available-lockers'],
    queryFn: async () => {
      const [{ data: lockers, error: lockersError }, { data: activeItems, error: activeError }] = await Promise.all([
        (supabase as any)
          .from('lockers')
          .select('id,code,campus,location,status')
          .eq('status', 'available')
          .order('code', { ascending: true }),
        (supabase as any)
          .from('lab_loan_items')
          .select('locker_id')
          .eq('active', true)
          .not('locker_id', 'is', null),
      ]);
      if (lockersError) throw lockersError;
      if (activeError) throw activeError;
      const inUse = new Set((activeItems || []).map((item: any) => String(item.locker_id)));
      return (lockers || []).filter((locker: any) => !inUse.has(String(locker.id)));
    },
  });
}

export function useCreateLabLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      borrower_name: string;
      borrower_sector: string;
      borrower_phone?: string;
      activity_type: string;
      activity_other?: string;
      shift: string;
      borrower_signature?: string | null;
      notes?: string;
      items: Array<{
        item_type: 'locker' | 'equipment' | 'manual';
        locker_id?: string;
        equipment_id?: string;
        manual_item_name?: string;
        quantity?: number;
        usage_mode: 'lab_use' | 'removal';
      }>;
    }) => {
      const { data, error } = await (supabase as any).rpc('create_lab_loan', {
        p_borrower_name: payload.borrower_name,
        p_borrower_sector: payload.borrower_sector,
        p_borrower_phone: payload.borrower_phone || null,
        p_activity_type: payload.activity_type,
        p_activity_other: payload.activity_other || null,
        p_shift: payload.shift,
        p_borrower_signature: payload.borrower_signature || null,
        p_notes: payload.notes || null,
        p_items: payload.items,
      });
      if (error) {
        if (String(error.message || '').includes('locker_already_in_use')) {
          throw new Error('Esta chave/armário já está em uso. Atualize a lista e escolha outro.');
        }
        throw error;
      }
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-loans'] });
      queryClient.invalidateQueries({ queryKey: ['lab-available-lockers'] });
      toast.success('Empréstimo de laboratório registrado.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useReturnLabLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      return_signature?: string | null;
      notes?: string;
      manual_reason?: string;
    }) => {
      const { error } = await (supabase as any).rpc('return_lab_loan', {
        p_lab_loan_id: payload.id,
        p_return_signature: payload.return_signature || null,
        p_notes: payload.notes || null,
        p_manual_reason: payload.manual_reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-loans'] });
      queryClient.invalidateQueries({ queryKey: ['lab-available-lockers'] });
      toast.success('Devolução registrada.');
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
