/**
 * Persistent localStorage cache for lost items data.
 * Provides instant loading on first visit by restoring cached data.
 */

import type { LostItem } from '@/hooks/useLostItems';

const CACHE_KEY = 'lost-items-cache';
const COUNTS_CACHE_KEY = 'lost-items-counts-cache';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes

interface CachedData {
  version: number;
  timestamp: number;
  data: {
    items: LostItem[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

interface CachedCounts {
  version: number;
  timestamp: number;
  data: {
    available: number;
    delivered: number;
    expired: number;
  };
}

/**
 * Save lost items data to localStorage
 */
export function saveLostItemsToCache(data: CachedData['data']): void {
  try {
    const cacheEntry: CachedData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (e) {
    // localStorage might be full or disabled - ignore
    console.warn('Failed to cache lost items:', e);
  }
}

/**
 * Load lost items data from localStorage
 * Returns null if cache is missing, expired, or invalid
 */
export function loadLostItemsFromCache(): CachedData['data'] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached: CachedData = JSON.parse(raw);
    
    // Version mismatch - invalidate
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Expired cache - still return it but it will be refreshed
    // This provides instant UI while fresh data loads
    if (Date.now() - cached.timestamp > CACHE_MAX_AGE) {
      // Return stale data for instant display, caller should refresh
      return cached.data;
    }

    return cached.data;
  } catch (e) {
    // Corrupted cache - remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Check if cache is stale (older than max age)
 */
export function isCacheStale(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return true;

    const cached: CachedData = JSON.parse(raw);
    return Date.now() - cached.timestamp > CACHE_MAX_AGE;
  } catch {
    return true;
  }
}

/**
 * Save counts to localStorage
 */
export function saveCountsToCache(data: CachedCounts['data']): void {
  try {
    const cacheEntry: CachedCounts = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(COUNTS_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to cache counts:', e);
  }
}

/**
 * Load counts from localStorage
 */
export function loadCountsFromCache(): CachedCounts['data'] | null {
  try {
    const raw = localStorage.getItem(COUNTS_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedCounts = JSON.parse(raw);
    
    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(COUNTS_CACHE_KEY);
      return null;
    }

    return cached.data;
  } catch (e) {
    localStorage.removeItem(COUNTS_CACHE_KEY);
    return null;
  }
}

/**
 * Clear all lost items cache
 */
export function clearLostItemsCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(COUNTS_CACHE_KEY);
}
