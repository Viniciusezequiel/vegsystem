/**
 * Persistent localStorage cache for equipment data.
 * Similar to lostItemsCache but for the equipment module.
 */

import type { Equipment, EquipmentLoan } from '@/hooks/useEquipment';

const EQUIPMENT_CACHE_KEY = 'equipment-cache';
const LOANS_CACHE_KEY = 'equipment-loans-cache';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

interface CachedEquipment {
  version: number;
  timestamp: number;
  data: Equipment[];
}

interface CachedLoans {
  version: number;
  timestamp: number;
  data: EquipmentLoan[];
}

/**
 * Save equipment list to cache
 */
export function saveEquipmentToCache(data: Equipment[]): void {
  try {
    const cacheEntry: CachedEquipment = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(EQUIPMENT_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to cache equipment:', e);
  }
}

/**
 * Load equipment list from cache
 */
export function loadEquipmentFromCache(): Equipment[] | null {
  try {
    const raw = localStorage.getItem(EQUIPMENT_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedEquipment = JSON.parse(raw);
    
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(EQUIPMENT_CACHE_KEY);
      return null;
    }

    // Return data even if stale - caller should refresh
    return cached.data;
  } catch (e) {
    localStorage.removeItem(EQUIPMENT_CACHE_KEY);
    return null;
  }
}

/**
 * Check if equipment cache is stale
 */
export function isEquipmentCacheStale(): boolean {
  try {
    const raw = localStorage.getItem(EQUIPMENT_CACHE_KEY);
    if (!raw) return true;

    const cached: CachedEquipment = JSON.parse(raw);
    return Date.now() - cached.timestamp > CACHE_MAX_AGE;
  } catch {
    return true;
  }
}

/**
 * Save equipment loans to cache
 */
export function saveLoansToCache(data: EquipmentLoan[]): void {
  try {
    const cacheEntry: CachedLoans = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(LOANS_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to cache equipment loans:', e);
  }
}

/**
 * Load equipment loans from cache
 */
export function loadLoansFromCache(): EquipmentLoan[] | null {
  try {
    const raw = localStorage.getItem(LOANS_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedLoans = JSON.parse(raw);
    
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(LOANS_CACHE_KEY);
      return null;
    }

    return cached.data;
  } catch (e) {
    localStorage.removeItem(LOANS_CACHE_KEY);
    return null;
  }
}

/**
 * Check if loans cache is stale
 */
export function isLoansCacheStale(): boolean {
  try {
    const raw = localStorage.getItem(LOANS_CACHE_KEY);
    if (!raw) return true;

    const cached: CachedLoans = JSON.parse(raw);
    return Date.now() - cached.timestamp > CACHE_MAX_AGE;
  } catch {
    return true;
  }
}

/**
 * Clear equipment cache
 */
export function clearEquipmentCache(): void {
  localStorage.removeItem(EQUIPMENT_CACHE_KEY);
  localStorage.removeItem(LOANS_CACHE_KEY);
}

/**
 * Merge pending operations with cached data
 * This allows offline-created items to appear in the list
 */
export function mergeEquipmentWithPending(
  cached: Equipment[],
  pendingOps: Array<{ action: string; payload: Record<string, unknown> }>
): Equipment[] {
  const merged = [...cached];
  
  for (const op of pendingOps) {
    if (op.action === 'create' && op.payload) {
      // Add pending creation to the list
      merged.unshift(op.payload as unknown as Equipment);
    }
    // Update and delete operations could also be handled here
  }
  
  return merged;
}
