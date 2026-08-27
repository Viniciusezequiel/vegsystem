import { useEffect, useState } from 'react';
import { resolveStorageUrl } from '@/lib/storageUrl';

/**
 * Turns a stored image value (private storage URL or legacy base64) into a
 * renderable URL. Signed URLs are cached and reused across components.
 */
export function useSignedImageUrl(storedValue: string | null | undefined, defaultBucket = 'lost-items') {
  const [url, setUrl] = useState<string | null>(
    storedValue && storedValue.startsWith('data:') ? storedValue : null
  );
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!storedValue) {
      setUrl(null);
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    resolveStorageUrl(storedValue, defaultBucket)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .finally(() => {
        if (!cancelled) setIsResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storedValue, defaultBucket]);

  return { url, isResolving };
}
