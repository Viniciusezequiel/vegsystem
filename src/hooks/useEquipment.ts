import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { saveEquipmentToCache, loadEquipmentFromCache, saveLoansToCache, loadLoansFromCache } from '@/lib/equipmentCache';

export type Equipment = {
  id: string;
  name: string;
  patrimony_code: string;
  old_patrimony_code: string | null;
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
  _pending?: boolean;
};

export type EquipmentLoan = {
  id: string;
  equipment_id: string;
  quantity_borrowed: number;
  borrower_name: string;
  borrower_sector: string;
  borrower_phone: string;
  borrower_signature: string | null;
  borrower_type: string | null;
  purpose: string | null;
  authorizer_name: string | null;
  authorizer_contact: string | null;
  collaborator_name: string | null;
  expected_return_date: string;
  actual_return_date: string | null;
  return_signature: string | null;
  return_collaborator_name: string | null;
  returner_name: string | null;
  returner_phone: string | null;
  item_condition: string | null;
  all_items_returned: boolean | null;
  pending_items_description: string | null;
  status: 'active' | 'returned' | 'overdue';
  loaned_by: string | null;
  returned_by: string | null;
  notes: string | null;
  loan_group_id: string | null;
  created_at: string;
  updated_at: string;
  equipment?: Equipment;
  _pending?: boolean;
};

export function useEquipmentList(search?: string) {
  const queryClient = useQueryClient();
  
  // Restore from cache on mount
  const cachedData = loadEquipmentFromCache();
  
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
    initialData: !search ? (cachedData ?? undefined) : undefined,
    queryFn: async () => {
      // OFFLINE: serve from cache
      if (!navigator.onLine) {
        const cached = loadEquipmentFromCache();
        if (cached) {
          // Apply search filter client-side
          if (search) {
            const q = search.toLowerCase();
            return cached.filter(e =>
              e.name?.toLowerCase().includes(q) ||
              e.patrimony_code?.toLowerCase().includes(q) ||
              e.old_patrimony_code?.toLowerCase().includes(q)
            );
          }
          return cached;
        }
        return [];
      }

      let query = supabase
        .from('equipment')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,patrimony_code.ilike.%${search}%,old_patrimony_code.ilike.%${search}%`);
      }

      try {
        const { data, error } = await query;
        if (error) throw error;
        
        // Save to cache (only full list without search)
        if (!search && data) {
          saveEquipmentToCache(data as Equipment[]);
        }
        
        return data as Equipment[];
      } catch (e) {
        // Fallback to cache on error
        const cached = loadEquipmentFromCache();
        if (cached) {
          if (search) {
            const q = search.toLowerCase();
            return cached.filter(eq =>
              eq.name?.toLowerCase().includes(q) ||
              eq.patrimony_code?.toLowerCase().includes(q) ||
              eq.old_patrimony_code?.toLowerCase().includes(q)
            );
          }
          return cached;
        }
        throw e;
      }
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
  
  // Restore from cache on mount
  const cachedLoans = loadLoansFromCache();
  
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
    initialData: cachedLoans ? (status ? cachedLoans.filter(l => l.status === status) : cachedLoans) : undefined,
    queryFn: async () => {
      // OFFLINE: serve from cache
      if (!navigator.onLine) {
        const cached = loadLoansFromCache();
        if (cached) {
          return status ? cached.filter(l => l.status === status) : cached;
        }
        return [];
      }

      let query = supabase
        .from('equipment_loans')
        .select('*, equipment(*)')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      try {
        const { data, error } = await query;
        if (error) throw error;
        
        // Save to cache (only full list without filter)
        if (!status && data) {
          saveLoansToCache(data as EquipmentLoan[]);
        }
        
        return data as EquipmentLoan[];
      } catch (e) {
        // Fallback to cache on error
        const cached = loadLoansFromCache();
        if (cached) {
          return status ? cached.filter(l => l.status === status) : cached;
        }
        throw e;
      }
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
      borrower_type?: string;
      purpose?: string;
      authorizer_name?: string;
      authorizer_contact?: string;
      collaborator_name?: string;
      skip_stock_deduction?: boolean;
      loan_group_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { skip_stock_deduction, loan_group_id, ...loanData } = loan;
      
      // Create loan first
      const { data, error } = await supabase
        .from('equipment_loans')
        .insert({ 
          equipment_id: loanData.equipment_id,
          quantity_borrowed: loanData.quantity_borrowed,
          borrower_name: loanData.borrower_name,
          borrower_sector: loanData.borrower_sector,
          borrower_phone: loanData.borrower_phone,
          expected_return_date: loanData.expected_return_date,
          notes: loanData.notes,
          borrower_signature: loanData.borrower_signature,
          borrower_type: loanData.borrower_type,
          purpose: loanData.purpose,
          authorizer_name: loanData.authorizer_name,
          authorizer_contact: loanData.authorizer_contact,
          collaborator_name: loanData.collaborator_name,
          loaned_by: user?.id,
          loan_group_id: loan_group_id || null,
        })
        .select()
        .single();
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar empréstimo: ' + error.message);
    },
  });
}

// Batch loan creation: validates stock upfront, creates all loans, then deducts stock once per equipment
export function useCreateBatchLoans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      items: Array<{
        equipment_id: string;
        quantity_borrowed: number;
        skip_stock_deduction?: boolean;
      }>;
      common: {
        borrower_name: string;
        borrower_sector: string;
        borrower_phone: string;
        expected_return_date: string;
        notes?: string;
        borrower_signature?: string;
        borrower_type?: string;
        purpose?: string;
        authorizer_name?: string;
        authorizer_contact?: string;
        collaborator_name?: string;
        loan_group_id?: string;
      };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { items, common } = params;

      // 1. Aggregate quantities per equipment for stock validation
      const stockNeeded = new Map<string, number>();
      for (const item of items) {
        if (!item.skip_stock_deduction) {
          stockNeeded.set(item.equipment_id, (stockNeeded.get(item.equipment_id) || 0) + item.quantity_borrowed);
        }
      }

      // 2. Validate stock for all equipment at once
      // Considera "disponibilidade projetada": pré-reservas futuras (que retiram DEPOIS
      // da devolução prevista deste empréstimo) não devem bloquear o empréstimo,
      // pois o item será devolvido a tempo.
      if (stockNeeded.size > 0) {
        const equipIds = Array.from(stockNeeded.keys());
        const { data: equipList, error: equipError } = await supabase
          .from('equipment')
          .select('id, available_quantity, name')
          .in('id', equipIds);
        
        if (equipError) throw equipError;

        // Buscar pré-reservas ativas que retiram DEPOIS da devolução do empréstimo atual
        // (essas reservas já debitaram estoque, mas o item estará devolvido antes da retirada delas)
        const { data: futureReservations } = await supabase
          .from('equipment_reservations')
          .select('equipment_id, quantity_reserved, scheduled_pickup_date')
          .in('equipment_id', equipIds)
          .in('status', ['awaiting_pickup', 'confirmed'])
          .gt('scheduled_pickup_date', common.expected_return_date);

        const projectedExtra = new Map<string, number>();
        for (const res of futureReservations || []) {
          projectedExtra.set(
            res.equipment_id,
            (projectedExtra.get(res.equipment_id) || 0) + (res.quantity_reserved || 0)
          );
        }

        for (const equip of equipList || []) {
          const needed = stockNeeded.get(equip.id) || 0;
          const projectedAvailable = equip.available_quantity + (projectedExtra.get(equip.id) || 0);
          if (projectedAvailable < needed) {
            throw new Error(`Quantidade indisponível para "${equip.name}": disponível ${projectedAvailable}, solicitado ${needed}`);
          }
        }
      }

      // 3. Create all loan records in a single insert
      const loanRecords = items.map(item => ({
        equipment_id: item.equipment_id,
        quantity_borrowed: item.quantity_borrowed,
        borrower_name: common.borrower_name,
        borrower_sector: common.borrower_sector,
        borrower_phone: common.borrower_phone,
        expected_return_date: common.expected_return_date,
        notes: common.notes,
        borrower_signature: common.borrower_signature,
        borrower_type: common.borrower_type,
        purpose: common.purpose,
        authorizer_name: common.authorizer_name,
        authorizer_contact: common.authorizer_contact,
        collaborator_name: common.collaborator_name,
        loaned_by: user?.id,
        loan_group_id: common.loan_group_id || null,
      }));

      const { data, error } = await supabase
        .from('equipment_loans')
        .insert(loanRecords)
        .select();
      if (error) throw error;

      // 4. Deduct stock once per equipment
      for (const [equipId, qty] of stockNeeded.entries()) {
        const { data: equip } = await supabase
          .from('equipment')
          .select('available_quantity')
          .eq('id', equipId)
          .single();
        
        if (equip) {
          const newAvailable = equip.available_quantity - qty;
          await supabase
            .from('equipment')
            .update({ 
              available_quantity: Math.max(0, newAvailable),
              status: newAvailable <= 0 ? 'borrowed' : 'available'
            })
            .eq('id', equipId);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
      toast.success('Empréstimo(s) registrado(s) com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar empréstimos: ' + error.message);
    },
  });
}

export function useDeleteEquipmentLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { loanIds: string[] }) => {
      // Fetch loans to restore stock for active ones
      const { data: loans, error: fetchError } = await supabase
        .from('equipment_loans')
        .select('id, equipment_id, quantity_borrowed, status')
        .in('id', params.loanIds);
      
      if (fetchError) throw fetchError;

      // Restore stock for active loans
      const stockRestore = new Map<string, number>();
      for (const loan of loans || []) {
        if (loan.status === 'active') {
          stockRestore.set(loan.equipment_id, (stockRestore.get(loan.equipment_id) || 0) + loan.quantity_borrowed);
        }
      }

      // Delete loans
      const { error } = await supabase
        .from('equipment_loans')
        .delete()
        .in('id', params.loanIds);
      if (error) throw error;

      // Restore equipment stock
      for (const [equipId, qty] of stockRestore.entries()) {
        const { data: equip } = await supabase
          .from('equipment')
          .select('available_quantity')
          .eq('id', equipId)
          .single();
        
        if (equip) {
          await supabase
            .from('equipment')
            .update({ 
              available_quantity: equip.available_quantity + qty,
              status: 'available'
            })
            .eq('id', equipId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
      toast.success('Empréstimo(s) excluído(s) com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir empréstimo: ' + error.message);
    },
  });
}

export function useUpdateLoanReturnDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { loanIds: string[]; expected_return_date: string }) => {
      const { error } = await supabase
        .from('equipment_loans')
        .update({ expected_return_date: params.expected_return_date })
        .in('id', params.loanIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-loans'] });
      toast.success('Data de devolução atualizada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar data de devolução: ' + error.message);
    },
  });
}

export function useReturnEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      loanId: string | string[];
      returner_name?: string;
      returner_phone?: string;
      returner_sector?: string;
      item_condition?: string;
      notes?: string;
      return_signature?: string;
      return_collaborator_name?: string;
      all_items_returned?: boolean;
      pending_items_description?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const loanIds = Array.isArray(data.loanId) ? data.loanId : [data.loanId];

      for (const loanId of loanIds) {
        // Get loan details
        const { data: loan, error: loanError } = await supabase
          .from('equipment_loans')
          .select('*, equipment(*)')
          .eq('id', loanId)
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
            returner_name: data.returner_name,
            returner_phone: data.returner_phone,
            item_condition: data.item_condition,
            return_collaborator_name: data.return_collaborator_name,
            all_items_returned: data.all_items_returned ?? true,
            pending_items_description: data.pending_items_description,
            notes: data.notes ? `${loan.notes ? loan.notes + '\n' : ''}Devolução: ${data.notes}` : loan.notes
          })
          .eq('id', loanId);
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
      }
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
