import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export type InventoryMovement = {
  id: string;
  equipment_id: string;
  movement_type: 'transfer' | 'write_off' | 'import' | 'adjustment';
  from_location: string | null;
  to_location: string | null;
  from_campus: string | null;
  to_campus: string | null;
  quantity: number;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  performed_by_name: string;
  created_at: string;
  equipment?: {
    id: string;
    name: string;
    patrimony_code: string;
    location: string;
    campus: string;
  };
};

export function useInventoryMovements(equipmentId?: string) {
  return useQuery({
    queryKey: ['inventory-movements', equipmentId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_movements')
        .select('*, equipment:equipment_id(id, name, patrimony_code, location, campus)')
        .order('created_at', { ascending: false });

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryMovement[];
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      equipment_id: string;
      from_location: string;
      to_location: string;
      from_campus: string;
      to_campus: string;
      quantity: number;
      reason?: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create movement record
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          equipment_id: data.equipment_id,
          movement_type: 'transfer',
          from_location: data.from_location,
          to_location: data.to_location,
          from_campus: data.from_campus,
          to_campus: data.to_campus,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes,
          performed_by: user?.id,
          performed_by_name: profile?.full_name || 'Sistema',
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Update equipment location
      const { error: updateError } = await supabase
        .from('equipment')
        .update({
          location: data.to_location,
          campus: data.to_campus as any,
        })
        .eq('id', data.equipment_id);

      if (updateError) throw updateError;

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Transferência registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar transferência: ' + error.message);
    },
  });
}

export function useCreateWriteOff() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      equipment_id: string;
      reason: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get current equipment data
      const { data: equipment, error: equipError } = await supabase
        .from('equipment')
        .select('location, campus')
        .eq('id', data.equipment_id)
        .single();

      if (equipError) throw equipError;

      // Create movement record
      const { data: movement, error: movementError } = await supabase
        .from('inventory_movements')
        .insert({
          equipment_id: data.equipment_id,
          movement_type: 'write_off',
          from_location: equipment.location,
          from_campus: equipment.campus,
          quantity: 1,
          reason: data.reason,
          notes: data.notes,
          performed_by: user?.id,
          performed_by_name: profile?.full_name || 'Sistema',
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Update equipment with write-off info
      const { error: updateError } = await supabase
        .from('equipment')
        .update({
          status: 'maintenance',
          write_off_date: new Date().toISOString().split('T')[0],
          write_off_reason: data.reason,
          write_off_by: user?.id,
          available_quantity: 0,
        })
        .eq('id', data.equipment_id);

      if (updateError) throw updateError;

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Baixa registrada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar baixa: ' + error.message);
    },
  });
}

export function useUpdateExternalLoanAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, allow_external_loan }: { id: string; allow_external_loan: boolean }) => {
      const { error } = await supabase
        .from('equipment')
        .update({ allow_external_loan })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Disponibilidade atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });
}

export function useBulkImportEquipment() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (items: Array<{
      name: string;
      patrimony_code: string;
      location: string;
      campus: 'Campus I' | 'Campus II' | 'Campus IV' | 'Campus HUCM Adm';
      quantity?: number;
      category?: string;
      description?: string;
      allow_external_loan?: boolean;
    }>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert all equipment
      const equipmentToInsert = items.map(item => ({
        name: item.name,
        patrimony_code: item.patrimony_code,
        location: item.location,
        campus: item.campus,
        quantity: item.quantity || 1,
        available_quantity: item.quantity || 1,
        category: item.category,
        description: item.description,
        allow_external_loan: item.allow_external_loan ?? true,
        status: 'available' as const,
        created_by: user?.id,
      }));

      const { data: insertedEquipment, error: insertError } = await supabase
        .from('equipment')
        .insert(equipmentToInsert)
        .select();

      if (insertError) throw insertError;

      // Create movement records for each imported item
      const movements = insertedEquipment.map(eq => ({
        equipment_id: eq.id,
        movement_type: 'import' as const,
        to_location: eq.location,
        to_campus: eq.campus,
        quantity: eq.quantity,
        reason: 'Importação em lote',
        performed_by: user?.id,
        performed_by_name: profile?.full_name || 'Sistema',
      }));

      await supabase.from('inventory_movements').insert(movements);

      return insertedEquipment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success(`${data.length} itens importados com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error('Erro na importação: ' + error.message);
    },
  });
}
