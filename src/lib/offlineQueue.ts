/**
 * Persistent queue for offline operations.
 * Operations are stored in localStorage and synced when connection is restored.
 */

export type OfflineOperationModule = 'lost-items' | 'equipment' | 'equipment-loans';
export type OfflineOperationAction = 'create' | 'update' | 'delete' | 'deliver' | 'return';

export interface OfflineOperation {
  id: string;
  module: OfflineOperationModule;
  action: OfflineOperationAction;
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const QUEUE_KEY = 'offline-operations-queue';
const MAX_RETRIES = 3;

/**
 * Generate a unique ID for operations
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all operations from the queue
 */
export function getQueue(): OfflineOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineOperation[];
  } catch {
    return [];
  }
}

/**
 * Save the queue to localStorage
 */
function saveQueue(queue: OfflineOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to save offline queue:', e);
  }
}

/**
 * Add a new operation to the queue
 */
export function addToQueue(
  module: OfflineOperationModule,
  action: OfflineOperationAction,
  payload: Record<string, unknown>
): OfflineOperation {
  const operation: OfflineOperation = {
    id: generateId(),
    module,
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  const queue = getQueue();
  queue.push(operation);
  saveQueue(queue);

  return operation;
}

/**
 * Remove an operation from the queue
 */
export function removeFromQueue(operationId: string): void {
  const queue = getQueue().filter(op => op.id !== operationId);
  saveQueue(queue);
}

/**
 * Update an operation in the queue
 */
export function updateOperation(operationId: string, updates: Partial<OfflineOperation>): void {
  const queue = getQueue().map(op =>
    op.id === operationId ? { ...op, ...updates } : op
  );
  saveQueue(queue);
}

/**
 * Increment retry count for an operation
 */
export function incrementRetry(operationId: string): boolean {
  const queue = getQueue();
  const op = queue.find(o => o.id === operationId);
  
  if (!op) return false;
  
  op.retries += 1;
  
  if (op.retries >= MAX_RETRIES) {
    op.status = 'failed';
  }
  
  saveQueue(queue);
  return op.retries < MAX_RETRIES;
}

/**
 * Mark an operation as failed
 */
export function markAsFailed(operationId: string, error?: string): void {
  updateOperation(operationId, { status: 'failed', error });
}

/**
 * Mark an operation as syncing
 */
export function markAsSyncing(operationId: string): void {
  updateOperation(operationId, { status: 'syncing' });
}

/**
 * Get pending operations count
 */
export function getPendingCount(): number {
  return getQueue().filter(op => op.status === 'pending' || op.status === 'syncing').length;
}

/**
 * Get failed operations count
 */
export function getFailedCount(): number {
  return getQueue().filter(op => op.status === 'failed').length;
}

/**
 * Clear failed operations from the queue
 */
export function clearFailedOperations(): void {
  const queue = getQueue().filter(op => op.status !== 'failed');
  saveQueue(queue);
}

/**
 * Clear all operations from the queue
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Get operations grouped by module
 */
export function getQueueByModule(): Record<OfflineOperationModule, OfflineOperation[]> {
  const queue = getQueue();
  return {
    'lost-items': queue.filter(op => op.module === 'lost-items'),
    'equipment': queue.filter(op => op.module === 'equipment'),
    'equipment-loans': queue.filter(op => op.module === 'equipment-loans'),
  };
}
