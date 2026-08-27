import { supabase } from '@/integrations/supabase/client';
import { getDeletableLostItemImagePath } from '@/lib/lostItemImageValue';
import { LostItemStorageClient } from '@/lib/lostItemStorageCore.mjs';

const storageClient = new LostItemStorageClient({
  uploadsFlag: import.meta.env.VITE_R2_NEW_UPLOADS_ENABLED,
  workerUrl: import.meta.env.VITE_STORAGE_WORKER_URL,
  getAccessToken: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  },
  uploadSupabase: async (file: File, path: string) => {
    const { error } = await supabase.storage.from('lost-items').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    return path;
  },
  deleteSupabase: async (locator: string) => {
    const path = getDeletableLostItemImagePath(locator);
    if (!path || path.startsWith('r2/')) throw new Error('Path Supabase inválido; imagem preservada.');
    const { error } = await supabase.storage.from('lost-items').remove([path]);
    if (error) throw error;
  },
});

export const r2NewUploadsEnabled = storageClient.useR2ForNewUploads;

export async function uploadLostItemImage(file: File, supabasePath: string) {
  return storageClient.upload(file, supabasePath);
}

export async function deleteStorageObjectSafely(locator: string | null | undefined) {
  const path = getDeletableLostItemImagePath(locator);
  if (!path) return { removed: false, preserved: true, reason: 'invalid-or-empty' };
  return storageClient.delete(path);
}

export async function loadReferencedLostItemImagePaths() {
  const paths = new Set<string>();
  for (const table of ['lost_items', 'lost_items_archive'] as const) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('image_url').not('image_url', 'is', null).range(from, from + 999);
      if (error) throw error;
      for (const row of data ?? []) {
        const path = getDeletableLostItemImagePath(row.image_url);
        if (path) paths.add(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return paths;
}

export async function deleteLostItemImageIfUnreferenced(locator: string | null | undefined) {
  const path = getDeletableLostItemImagePath(locator);
  if (!path) return { removed: false, preserved: true, reason: 'invalid-or-empty' };
  let referencedPaths: Set<string>;
  try { referencedPaths = await loadReferencedLostItemImagePaths(); }
  catch (error) { return { removed: false, preserved: true, reason: 'reference-check-failed', error }; }
  if (referencedPaths.has(path)) return { removed: false, preserved: true, reason: 'referenced' };
  try { return await deleteStorageObjectSafely(path); }
  catch (error) { return { removed: false, preserved: true, reason: 'delete-failed', error }; }
}
