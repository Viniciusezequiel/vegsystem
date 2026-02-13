import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LostItem } from '@/hooks/useLostItems';
import type { Equipment, EquipmentLoan } from '@/hooks/useEquipment';
import {
  loadLostItemsFromCache,
  loadCountsFromCache,
  loadImagesFromCache,
  saveLostItemsToCache,
  saveCountsToCache,
  saveImagesToCache,
} from '@/lib/lostItemsCache';
import {
  loadEquipmentFromCache,
  loadLoansFromCache,
  saveEquipmentToCache,
  saveLoansToCache,
} from '@/lib/equipmentCache';
import { LOST_ITEMS_LIST_SELECT } from '@/lib/lostItemsSelect';
import { setImagePrefetchProgress, resetImagePrefetchProgress } from '@/hooks/useImagePrefetchProgress';

const DEFAULT_QUERY_KEY = ['lost-items', 'available', undefined, 0, 100, undefined, undefined, undefined, undefined];
const COUNTS_QUERY_KEY = ['lost-items-counts'];
const EQUIPMENT_QUERY_KEY = ['equipment', undefined];
const LOANS_QUERY_KEY = ['equipment-loans', undefined];

const IMAGE_PREFETCH_BATCH_SIZE = 20;
const IMAGE_PREFETCH_DELAY_MS = 100;

export function GlobalPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const cachedItems = loadLostItemsFromCache();
    const cachedCounts = loadCountsFromCache();
    const cachedImages = loadImagesFromCache();
    const cachedEquipment = loadEquipmentFromCache();
    const cachedLoans = loadLoansFromCache();

    const hasCachedImages =
      !!cachedImages &&
      typeof cachedImages === 'object' &&
      Object.keys(cachedImages).length > 0;

    // Restore lost items safely
    if (cachedItems && Array.isArray((cachedItems as any).items)) {
      queryClient.setQueryData(DEFAULT_QUERY_KEY, cachedItems);
    }

    if (cachedCounts) {
      queryClient.setQueryData(COUNTS_QUERY_KEY, cachedCounts);
    }

    if (Array.isArray(cachedEquipment)) {
      queryClient.setQueryData(EQUIPMENT_QUERY_KEY, cachedEquipment);
    }

    if (Array.isArray(cachedLoans)) {
      queryClient.setQueryData(LOANS_QUERY_KEY, cachedLoans);
    }

    if (hasCachedImages && cachedImages) {
      for (const [itemId, imageUrl] of Object.entries(cachedImages)) {
        if (
          typeof imageUrl === 'string' &&
          (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))
        ) {
          queryClient.setQueryData(['lost-item-image', itemId], imageUrl);
        }
      }
    }

    if (
      cachedItems &&
      Array.isArray((cachedItems as any).items) &&
      !hasCachedImages
    ) {
      prefetchImagesForItems(queryClient, (cachedItems as any).items);
    }

    const fetchFreshData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const [itemsResult, countsResult, equipmentResult, loansResult] =
          await Promise.all([
            supabase
              .from('lost_items')
              .select(LOST_ITEMS_LIST_SELECT, { count: 'exact' })
              .eq('status', 'available')
              .order('created_at', { ascending: false })
              .range(0, 99),

            Promise.all([
              supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'available'),
              supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
              supabase.from('lost_items').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
            ]),

            supabase.from('equipment').select('*').order('created_at', { ascending: false }),

            supabase.from('equipment_loans').select('*, equipment(*)').order('created_at', { ascending: false }),
          ]);

        if (!itemsResult.error && Array.isArray(itemsResult.data)) {
          const items = itemsResult.data as LostItem[];

          const itemsData = {
            items,
            totalCount: itemsResult.count ?? 0,
            page: 0,
            pageSize: 100,
            totalPages: Math.ceil((itemsResult.count ?? 0) / 100),
          };

          queryClient.setQueryData(DEFAULT_QUERY_KEY, itemsData);
          saveLostItemsToCache(itemsData);

          prefetchImagesForItems(queryClient, items);
        }

        const [availableResult, deliveredResult, expiredResult] = countsResult;

        if (!availableResult.error && !deliveredResult.error && !expiredResult.error) {
          const available = availableResult.count ?? 0;
          const delivered = deliveredResult.count ?? 0;
          const expired = expiredResult.count ?? 0;

          const countsData = {
            total: available + delivered + expired,
            available,
            delivered,
            expired,
          };

          queryClient.setQueryData(COUNTS_QUERY_KEY, countsData);
          saveCountsToCache(countsData);
        }

        if (!equipmentResult.error && Array.isArray(equipmentResult.data)) {
          const equipmentData = equipmentResult.data as Equipment[];
          queryClient.setQueryData(EQUIPMENT_QUERY_KEY, equipmentData);
          saveEquipmentToCache(equipmentData);
        }

        if (!loansResult.error && Array.isArray(loansResult.data)) {
          const loansData = loansResult.data as EquipmentLoan[];
          queryClient.setQueryData(LOANS_QUERY_KEY, loansData);
          saveLoansToCache(loansData);
        }
      } catch (e) {
        console.error('GlobalPrefetch error:', e);
      }
    };

    fetchFreshData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) fetchFreshData();
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return null;
}

async function prefetchImagesForItems(
  queryClient: ReturnType<typeof useQueryClient>,
  items: LostItem[] | null | undefined
) {
  if (!Array.isArray(items) || items.length === 0) return;

  const itemsToFetch = items.filter(item => {
    const cached = queryClient.getQueryData(['lost-item-image', item.id]);
    return cached === undefined || cached === null;
  });

  if (itemsToFetch.length === 0) return;

  resetImagePrefetchProgress();

  const totalItems = itemsToFetch.length;
  let loadedItems = 0;

  setImagePrefetchProgress(loadedItems, totalItems);

  const batches: LostItem[][] = [];
  for (let i = 0; i < itemsToFetch.length; i += IMAGE_PREFETCH_BATCH_SIZE) {
    batches.push(itemsToFetch.slice(i, i + IMAGE_PREFETCH_BATCH_SIZE));
  }

  const allFetchedImages: Record<string, string> = {};

  for (const batch of batches) {
    try {
      const ids = batch.map(item => item.id);

      const { data, error } = await supabase
        .from('lost_items')
        .select('id, image_url')
        .in('id', ids)
        .not('image_url', 'is', null);

      if (!error && Array.isArray(data)) {
        const byId = new Map<string, string>();

        for (const row of data) {
          if (row.image_url) byId.set(row.id, row.image_url);
        }

        for (const id of ids) {
          const url = byId.get(id) ?? null;
          queryClient.setQueryData(['lost-item-image', id], url);
          if (url) allFetchedImages[id] = url;
        }
      }

      loadedItems += batch.length;
      setImagePrefetchProgress(loadedItems, totalItems);

      await new Promise(resolve =>
        setTimeout(resolve, IMAGE_PREFETCH_DELAY_MS)
      );
    } catch (e) {
      console.error('Image prefetch error:', e);
      loadedItems += batch.length;
      setImagePrefetchProgress(loadedItems, totalItems);
    }
  }

  if (Object.keys(allFetchedImages).length > 0) {
    saveImagesToCache(allFetchedImages);
  }
}
