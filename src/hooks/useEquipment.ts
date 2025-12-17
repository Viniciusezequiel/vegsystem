import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type Equipment = {
  id: string;
  name: string;
  patrimony_code: string;
  quantity: number;
  available_quantity: number;
  location: string;
  campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: 'available' | 'borrowed' | 'maintenance';
  allow_external_loan: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EquipmentLoan = {
  id: string;
  equipment_id: string;
  quantity_borrowed: number;
  borrower_name: string;
  borrower_sector: string;
  borrower_phone: string;
  borrower_signature: string | null;
  expected_return_date: string;
  actual_return_date: string | null;
  return_signature: string | null;
  status: 'active' | 'returned' | 'overdue';
  loaned_by: string | null;
  returned_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  equipment?: Equipment;
};

export function useEquipmentList(search?: string) {
  const queryClient = useQueryClient();
  
  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('equipment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['equipment', search],
    queryFn: async () => {
      let query = supabase
        .from('equipment')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,patrimony_code.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Equipment[];
    },
  });
}

export function useEquipment(id: string) {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Equipment | null;
    },
    enabled: !!id,
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (equipment: Omit<Equipment, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('equipment')
        .insert({ ...equipment, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipamento cadastrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar equipamento: ' + error.message);
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...equipment }: Partial<Equipment> & { id: string }) => {
      const { data, error } = await supabase
        .from('equipment')
        .update(equipment)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipamento atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar equipamento: ' + error.message);
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipment').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipamento excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir equipamento: ' + error.message);
    },
  });
}

export function useEquipmentLoans(status?: 'active' | 'returned' | 'overdue') {
  const queryClient = useQueryClient();
  
  // Set up realtime subscription for loans
  useEffect(() => {
    const channel = supabase
      .channel('equipment-loans-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment_loans'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
          queryClient.invalidateQueries({ queryKey: ['equipment'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['equipment-loans', status],
    queryFn: async () => {
      let query = supabase
        .from('equipment_loans')
        .select('*, equipment(*)')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EquipmentLoan[];
    },
  });
}

export function useOverdueLoans() {
  return useQuery({
    queryKey: ['equipment-loans', 'overdue-check'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('equipment_loans')
        .select('*, equipment(*)')
        .eq('status', 'active')
        .lt('expected_return_date', today);
      if (error) throw error;
      return data as EquipmentLoan[];
    },
  });
}

export function useCreateEquipmentLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (loan: {
      equipment_id: string;
      quantity_borrowed: number;
      borrower_name: string;
      borrower_sector: string;
      borrower_phone: string;
      expected_return_date: string;
      notes?: string;
      borrower_signature?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // First, update equipment available quantity
      const { data: equipment, error: equipError } = await supabase
        .from('equipment')
        .select('available_quantity')
        .eq('id', loan.equipment_id)
        .single();
      
      if (equipError) throw equipError;
      
      if (equipment.available_quantity < loan.quantity_borrowed) {
        throw new Error('Quantidade indisponível');
      }

      // Create loan
      const { data, error } = await supabase
        .from('equipment_loans')
        .insert({ 
          equipment_id: loan.equipment_id,
          quantity_borrowed: loan.quantity_borrowed,
          borrower_name: loan.borrower_name,
          borrower_sector: loan.borrower_sector,
          borrower_phone: loan.borrower_phone,
          expected_return_date: loan.expected_return_date,
          notes: loan.notes,
          borrower_signature: loan.borrower_signature,
          loaned_by: user?.id 
        })
        .select()
        .single();
      if (error) throw error;

      // Update available quantity
      const newAvailable = equipment.available_quantity - loan.quantity_borrowed;
      await supabase
        .from('equipment')
        .update({ 
          available_quantity: newAvailable,
          status: newAvailable === 0 ? 'borrowed' : 'available'
        })
        .eq('id', loan.equipment_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
      toast.success('Empréstimo registrado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar empréstimo: ' + error.message);
    },
  });
}

export function useReturnEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      loanId: string;
      returner_name?: string;
      returner_phone?: string;
      returner_sector?: string;
      item_condition?: string;
      notes?: string;
      return_signature?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get loan details
      const { data: loan, error: loanError } = await supabase
        .from('equipment_loans')
        .select('*, equipment(*)')
        .eq('id', data.loanId)
        .single();
      
      if (loanError) throw loanError;

      // Update loan status with return info
      const { error } = await supabase
        .from('equipment_loans')
        .update({ 
          status: 'returned',
          actual_return_date: new Date().toISOString().split('T')[0],
          returned_by: user?.id,
          return_signature: data.return_signature,
          notes: data.notes ? `${loan.notes ? loan.notes + '\n' : ''}Devolução: ${data.notes}${data.item_condition ? ` (Condição: ${data.item_condition})` : ''}` : loan.notes
        })
        .eq('id', data.loanId);
      if (error) throw error;

      // Update equipment available quantity
      const equip = loan.equipment as Equipment;
      await supabase
        .from('equipment')
        .update({ 
          available_quantity: equip.available_quantity + loan.quantity_borrowed,
          status: 'available'
        })
        .eq('id', loan.equipment_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
      toast.success('Devolução registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar devolução: ' + error.message);
    },
  });
}
