/**
 * This file is now deprecated.
 * Due to base64 images (up to 19MB each) causing database timeouts,
 * images are no longer loaded in the item list.
 * 
 * Use the "Otimizar Imagens" button in the admin panel to migrate
 * base64 images to Supabase Storage URLs.
 * 
 * Full images are shown only in item detail views.
 */

// Stub exports for backwards compatibility
export function useBatchedImage(_itemId: string | undefined) {
  return { 
    imageUrl: null, 
    isLoading: false, 
    requestImage: () => {} 
  };
}

export function prefetchImages(_itemIds: string[]) {
  // No-op - images are not prefetched anymore
}
