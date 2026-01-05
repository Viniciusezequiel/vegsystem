/**
 * Persistent localStorage cache for lost items data.
 * Provides instant loading on first visit by restoring cached data.
 */

import type { LostItem } from '@/hooks/useLostItems';

const CACHE_KEY = 'lost-items-cache';
const COUNTS_CACHE_KEY = 'lost-items-counts-cache';
const IMAGES_CACHE_KEY = 'lost-items-images-cache';
const CACHE_VERSION = 2;
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
    total: number;
    available: number;
    delivered: number;
    expired: number;
  };
}

interface CachedImages {
  version: number;
  timestamp: number;
  data: Record<string, string | null>; // itemId -> imageUrl or null
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
 * Save images cache to localStorage
 */
export function saveImagesToCache(images: Record<string, string | null>): void {
  try {
    // We only persist valid URLs.
    // Storing nulls would "poison" the cache and prevent newly-migrated images from showing.
    const existing = loadImagesFromCache() || {};

    const merged: Record<string, string> = { ...existing };

    for (const [itemId, url] of Object.entries(images)) {
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        merged[itemId] = url;
      } else if (url === null) {
        // Remove any previously cached URL if caller explicitly sets null
        delete merged[itemId];
      }
    }

    const cacheEntry = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: merged,
    } satisfies CachedImages;

    localStorage.setItem(IMAGES_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch (e) {
    console.warn('Failed to cache images:', e);
  }
}

/**
 * Load images cache from localStorage
 */
export function loadImagesFromCache(): Record<string, string | null> | null {
  try {
    const raw = localStorage.getItem(IMAGES_CACHE_KEY);
    if (!raw) return null;

    const cached: CachedImages = JSON.parse(raw);

    if (cached.version !== CACHE_VERSION) {
      localStorage.removeItem(IMAGES_CACHE_KEY);
      return null;
    }

    // Filter out null/invalid entries from older versions or partial migrations
    const filtered: Record<string, string> = {};
    for (const [itemId, url] of Object.entries(cached.data || {})) {
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        filtered[itemId] = url;
      }
    }

    return filtered;
  } catch (e) {
    localStorage.removeItem(IMAGES_CACHE_KEY);
    return null;
  }
}

/**
 * Clear all lost items cache
 */
export function clearLostItemsCache(): void {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(COUNTS_CACHE_KEY);
  localStorage.removeItem(IMAGES_CACHE_KEY);
}
