/**
 * Sync Manager - Handles background synchronization of offline operations
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getQueue,
  removeFromQueue,
  markAsSyncing,
  incrementRetry,
  markAsFailed,
  type OfflineOperation,
} from './offlineQueue';

type SyncCallback = (success: boolean, synced: number, failed: number) => void;

let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Process a single operation
 */
async function processOperation(op: OfflineOperation): Promise<boolean> {
  markAsSyncing(op.id);

  try {
    switch (op.module) {
      case 'lost-items':
        return await processLostItemOperation(op);
      case 'equipment':
        return await processEquipmentOperation(op);
      case 'equipment-loans':
        return await processEquipmentLoanOperation(op);
      default:
        console.warn('Unknown module:', op.module);
        return false;
    }
  } catch (error) {
    console.error('Sync operation failed:', error);
    const canRetry = incrementRetry(op.id);
    if (!canRetry) {
      markAsFailed(op.id, error instanceof Error ? error.message : 'Unknown error');
    }
    return false;
  }
}

/**
 * Process lost items operations
 */
async function processLostItemOperation(op: OfflineOperation): Promise<boolean> {
  const { action, payload } = op;

  switch (action) {
    case 'create': {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData = { ...payload, registered_by: user?.id } as any;
      const { error } = await supabase
        .from('lost_items')
        .insert(insertData);
      
      if (error) throw error;
      return true;
    }
    case 'update': {
      const { id, ...updateData } = payload;
      const { error } = await supabase
        .from('lost_items')
        .update(updateData)
        .eq('id', id as string);
      
      if (error) throw error;
      return true;
    }
    case 'deliver': {
      const { id, ...deliverData } = payload;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('lost_items')
        .update({
          ...deliverData,
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivered_by_team_member: user?.id,
        })
        .eq('id', id as string);
      
      if (error) throw error;
      return true;
    }
    case 'delete': {
      const { id } = payload;
      const { error } = await supabase
        .from('lost_items')
        .delete()
        .eq('id', id as string);
      
      if (error) throw error;
      return true;
    }
    default:
      console.warn('Unknown lost items action:', action);
      return false;
  }
}

/**
 * Process equipment operations
 */
async function processEquipmentOperation(op: OfflineOperation): Promise<boolean> {
  const { action, payload } = op;

  switch (action) {
    case 'create': {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData = { ...payload, created_by: user?.id } as any;
      const { error } = await supabase
        .from('equipment')
        .insert(insertData);
      
      if (error) throw error;
      return true;
    }
    case 'update': {
      const { id, ...updateData } = payload;
      const { error } = await supabase
        .from('equipment')
        .update(updateData)
        .eq('id', id as string);
      
      if (error) throw error;
      return true;
    }
    case 'delete': {
      const { id } = payload;
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', id as string);
      
      if (error) throw error;
      return true;
    }
    default:
      console.warn('Unknown equipment action:', action);
      return false;
  }
}

/**
 * Process equipment loan operations
 */
async function processEquipmentLoanOperation(op: OfflineOperation): Promise<boolean> {
  const { action, payload } = op;

  switch (action) {
    case 'create': {
      const { data: { user } } = await supabase.auth.getUser();
      const { equipment_id, quantity_borrowed } = payload;

      // Create loan
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertData = { ...payload, loaned_by: user?.id } as any;
      const { error: loanError } = await supabase
        .from('equipment_loans')
        .insert(insertData);
      
      if (loanError) throw loanError;

      // Update available quantity
      const { data: equipment } = await supabase
        .from('equipment')
        .select('available_quantity')
        .eq('id', equipment_id as string)
        .single();

      if (equipment) {
        const newAvailable = equipment.available_quantity - (quantity_borrowed as number);
        await supabase
          .from('equipment')
          .update({ 
            available_quantity: newAvailable,
            status: newAvailable === 0 ? 'borrowed' : 'available'
          })
          .eq('id', equipment_id as string);
      }

      return true;
    }
    case 'return': {
      const { loanId, ...returnData } = payload;
      const { data: { user } } = await supabase.auth.getUser();

      // Get loan details
      const { data: loan } = await supabase
        .from('equipment_loans')
        .select('*, equipment(*)')
        .eq('id', loanId as string)
        .single();

      if (!loan) throw new Error('Loan not found');

      // Update loan
      const { error } = await supabase
        .from('equipment_loans')
        .update({
          status: 'returned',
          actual_return_date: new Date().toISOString().split('T')[0],
          returned_by: user?.id,
          ...returnData,
        })
        .eq('id', loanId as string);

      if (error) throw error;

      // Update equipment quantity
      const equip = loan.equipment;
      if (equip) {
        await supabase
          .from('equipment')
          .update({
            available_quantity: equip.available_quantity + loan.quantity_borrowed,
            status: 'available',
          })
          .eq('id', loan.equipment_id);
      }

      return true;
    }
    default:
      console.warn('Unknown equipment loan action:', action);
      return false;
  }
}

/**
 * Process all pending operations in the queue
 */
export async function processQueue(callback?: SyncCallback): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const queue = getQueue().filter(op => op.status === 'pending');

    for (const op of queue) {
      const success = await processOperation(op);
      
      if (success) {
        removeFromQueue(op.id);
        synced++;
      } else {
        failed++;
      }
    }

    callback?.(synced > 0 || failed === 0, synced, failed);
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Start automatic sync interval
 */
export function startAutoSync(intervalMs: number = 30000, callback?: SyncCallback): void {
  if (syncInterval) return;

  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      processQueue(callback);
    }
  }, intervalMs);
}

/**
 * Stop automatic sync
 */
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Check if currently syncing
 */
export function getIsSyncing(): boolean {
  return isSyncing;
}
