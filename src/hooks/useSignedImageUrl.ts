import { useEffect, useState } from 'react';
import { getStorageProvider, resolveStorageUrl } from '@/lib/storageUrl';

/**
 * Turns a stored image value into a renderable URL.
 * Retries transient resolution failures, which are more common
 * during session restoration on slower mobile/tablet browsers.
 */
export function useSignedImageUrl(
  storedValue: string | null | undefined,
  defaultBucket = 'lost-items'
) {
  const [url, setUrl] = useState<string | null>(
    storedValue && storedValue.startsWith('data:')
      ? storedValue
      : null
  );

  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (!storedValue) {
      setUrl(null);
      setIsResolving(false);
      return;
    }

    // Achados e Perdidos foi migrado integralmente para R2. Caminhos antigos
    // podem sobreviver em localStorage de aparelhos antigos; não permita que
    // eles voltem a gerar signed URLs/downloads no Supabase Storage.
    if (
      defaultBucket === 'lost-items' &&
      !storedValue.startsWith('data:') &&
      getStorageProvider(storedValue) !== 'r2'
    ) {
      setUrl(null);
      setIsResolving(false);
      return;
    }

    const resolve = async (attempt = 0) => {
      setIsResolving(true);

      try {
        const resolved = await resolveStorageUrl(
          storedValue,
          defaultBucket
        );

        if (cancelled) return;

        if (resolved) {
          setUrl(resolved);
          setIsResolving(false);
          return;
        }

        if (attempt < 2) {
          retryTimer = setTimeout(
            () => void resolve(attempt + 1),
            600 * (attempt + 1)
          );
          return;
        }

        setUrl(null);
        setIsResolving(false);
      } catch {
        if (cancelled) return;

        if (attempt < 2) {
          retryTimer = setTimeout(
            () => void resolve(attempt + 1),
            600 * (attempt + 1)
          );
          return;
        }

        setUrl(null);
        setIsResolving(false);
      }
    };

    void resolve();

    const handleOnline = () => {
      if (!cancelled && !url) {
        void resolve();
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      window.removeEventListener(
        'online',
        handleOnline
      );
    };
  }, [storedValue, defaultBucket]);

  return { url, isResolving };
}
