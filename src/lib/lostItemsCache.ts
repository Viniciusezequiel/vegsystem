/**
 * Persistent localStorage cache for lost items data.
 * Provides instant loading on first visit by restoring cached data.
 */

import type { LostItem } from '@/hooks/useLostItems';
import { validateR2LostItemLocator } from '@/lib/lostItemStorageCore.mjs';

const CACHE_KEY = 'lost-items-cache';
const COUNTS_CACHE_KEY = 'lost-items-counts-cache';
const IMAGES_CACHE_KEY = 'lost-items-images-cache';
const CACHE_VERSION = 4;
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
  data: Record<string, string | null>; // itemId -> R2 locator or null
}

function r2ImageLocator(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return validateR2LostItemLocator(value.trim())?.locator ?? null;
}

function sanitizeLostItemsCache(data: CachedData['data']): CachedData['data'] {
  return {
    ...data,
    items: (data.items || []).map((item) => ({
      ...item,
      // Após a migração, imagens de Achados e Perdidos são exclusivamente R2.
      // Nunca reidrate caminhos legados do Supabase Storage a partir do navegador.
      image_url: r2ImageLocator(item.image_url),
    })),
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
      data: sanitizeLostItemsCache(data),
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
      return sanitizeLostItemsCache(cached.data);
    }

    return sanitizeLostItemsCache(cached.data);
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
    // Persist only validated object paths. Never keep Base64, blob/external URLs,
    // signed URLs or private binary content in localStorage.
    const existing = loadImagesFromCache() || {};

    const merged: Record<string, string> = { ...existing };

    for (const [itemId, value] of Object.entries(images)) {
      const path = r2ImageLocator(value);
      if (path) {
        merged[itemId] = path;
      } else if (value === null) {
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
    for (const [itemId, value] of Object.entries(cached.data || {})) {
      const path = r2ImageLocator(value);
      if (path) filtered[itemId] = path;
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
