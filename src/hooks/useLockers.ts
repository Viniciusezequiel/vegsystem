import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Locker = {
  id: string;
  code: string;
  campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
  location: string;
  description: string | null;
  status: 'available' | 'occupied';
  created_at: string;
  updated_at: string;
};

export type LockerLoan = {
  id: string;
  locker_id: string;
  borrower_name: string;
  borrower_phone: string;
  borrower_email: string | null;
  borrower_sector: string | null;
  borrower_signature: string | null;
  expected_return_date: string;
  actual_return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
  loaned_by: string | null;
  returned_by: string | null;
  notes: string | null;
  return_signature: string | null;
  returner_name: string | null;
  created_at: string;
  updated_at: string;
  locker?: Locker;
};

export type LockerExchange = {
  id: string;
  old_loan_id: string;
  old_locker_id: string;
  new_locker_id: string;
  new_loan_id: string | null;
  reason: string | null;
  performed_by: string | null;
  performed_by_name: string;
  created_at: string;
};

export function useLockersList(statusFilter?: 'available' | 'occupied') {
  return useQuery({
    queryKey: ['lockers', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('lockers')
        .select('*')
        .order('code', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Locker[];
    },
  });
}

export function useLocker(id: string) {
  return useQuery({
    queryKey: ['locker', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lockers')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Locker | null;
    },
    enabled: !!id,
  });
}

export function useCreateLocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locker: Omit<Locker, 'id' | 'created_at' | 'updated_at' | 'status'>) => {
      const { data, error } = await supabase
        .from('lockers')
        .insert(locker)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      toast.success('Escaninho cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar escaninho: ' + error.message);
    },
  });
}

export function useUpdateLocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...locker }: Partial<Locker> & { id: string }) => {
      const { data, error } = await supabase
        .from('lockers')
        .update(locker)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      toast.success('Escaninho atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar escaninho: ' + error.message);
    },
  });
}

export function useDeleteLocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lockers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      toast.success('Escaninho excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir escaninho: ' + error.message);
    },
  });
}

export function useLockerLoans(status?: 'active' | 'returned' | 'overdue') {
  return useQuery({
    queryKey: ['locker-loans', status],
    queryFn: async () => {
      let query = supabase
        .from('locker_loans')
       .select('*, lockers!locker_loans_locker_id_fkey(*)')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LockerLoan[];
    },
  });
}

export function useOverdueLockerLoans() {
  return useQuery({
    queryKey: ['locker-loans', 'overdue-check'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('locker_loans')
        .select('*, lockers!locker_loans_locker_id_fkey(*)')
        .eq('status', 'active')
        .lt('expected_return_date', today);
      if (error) throw error;
      return data as LockerLoan[];
    },
  });
}

export function useCreateLockerLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loan: {
      locker_id: string;
      borrower_name: string;
      borrower_phone: string;
      borrower_email?: string;
      borrower_sector?: string;
      borrower_signature?: string;
      expected_return_date: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create loan
      const { data, error } = await supabase
        .from('locker_loans')
        .insert({ 
          locker_id: loan.locker_id,
          borrower_name: loan.borrower_name,
          borrower_phone: loan.borrower_phone,
          borrower_email: loan.borrower_email,
          borrower_sector: loan.borrower_sector,
          borrower_signature: loan.borrower_signature,
          expected_return_date: loan.expected_return_date,
          notes: loan.notes,
          loaned_by: user?.id 
        })
        .select()
        .single();
      if (error) throw error;

      // Update locker status
      await supabase
        .from('lockers')
        .update({ status: 'occupied' })
        .eq('id', loan.locker_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-loans'] });
      toast.success('Empréstimo de escaninho registrado!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar empréstimo: ' + error.message);
    },
  });
}

export function useReturnLocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ loanId, returnerName, signature, notes }: { 
      loanId: string; 
      returnerName?: string;
      signature?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get loan details
      const { data: loan, error: loanError } = await supabase
        .from('locker_loans')
        .select('*')
        .eq('id', loanId)
        .single();
      
      if (loanError) throw loanError;

      // Update loan status
      const { error } = await supabase
        .from('locker_loans')
        .update({ 
          status: 'returned',
          actual_return_date: new Date().toISOString().split('T')[0],
          returned_by: user?.id,
          returner_name: returnerName || null,
          return_signature: signature || null,
          notes: notes || loan.notes,
        })
        .eq('id', loanId);
      if (error) throw error;

      // Update locker status
      await supabase
        .from('lockers')
        .update({ status: 'available' })
        .eq('id', loan.locker_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-loans'] });
      toast.success('Devolução de escaninho registrada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar devolução: ' + error.message);
    },
  });
}

export function useExchangeLocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      loanId, 
      newLockerId, 
      reason 
    }: { 
      loanId: string; 
      newLockerId: string;
      reason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      // Get current loan details
      const { data: oldLoan, error: loanError } = await supabase
        .from('locker_loans')
        .select('*')
        .eq('id', loanId)
        .single();
      
      if (loanError) throw loanError;

      // Mark old loan as returned
      await supabase
        .from('locker_loans')
        .update({ 
          status: 'returned',
          actual_return_date: new Date().toISOString().split('T')[0],
          returned_by: user?.id,
          notes: `Troca de escaninho - ${reason}`
        })
        .eq('id', loanId);

      // Set old locker as available
      await supabase
        .from('lockers')
        .update({ status: 'available' })
        .eq('id', oldLoan.locker_id);

      // Create new loan with same borrower info
      const { data: newLoan, error: newLoanError } = await supabase
        .from('locker_loans')
        .insert({
          locker_id: newLockerId,
          borrower_name: oldLoan.borrower_name,
          borrower_phone: oldLoan.borrower_phone,
          borrower_email: oldLoan.borrower_email,
          borrower_sector: oldLoan.borrower_sector,
          expected_return_date: oldLoan.expected_return_date,
          loaned_by: user?.id,
          notes: `Troca do escaninho anterior - ${reason}`,
        })
        .select()
        .single();

      if (newLoanError) throw newLoanError;

      // Set new locker as occupied
      await supabase
        .from('lockers')
        .update({ status: 'occupied' })
        .eq('id', newLockerId);

      // Record the exchange
      await supabase
        .from('locker_exchanges')
        .insert({
          old_loan_id: loanId,
          old_locker_id: oldLoan.locker_id,
          new_locker_id: newLockerId,
          new_loan_id: newLoan.id,
          reason,
          performed_by: user?.id,
          performed_by_name: profile?.full_name || user?.email || 'Sistema',
        });

      return newLoan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      queryClient.invalidateQueries({ queryKey: ['locker-loans'] });
      toast.success('Troca de escaninho realizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao trocar escaninho: ' + error.message);
    },
  });
}
