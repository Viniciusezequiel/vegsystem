import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for lazy loading images from Supabase
 * Only fetches the image_url when the element is visible
 */
export function useLazyImage(itemId: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasFetched = useRef(false);

  const fetchImage = async () => {
    if (!itemId || hasFetched.current) return;
    
    hasFetched.current = true;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('lost_items')
        .select('image_url')
        .eq('id', itemId)
        .maybeSingle();
      
      if (error) throw error;
      setImageUrl(data?.image_url || null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { imageUrl, isLoading, error, fetchImage };
}

/**
 * Hook for intersection observer based lazy loading
 */
export function useIntersectionObserver(
  callback: () => void,
  options?: IntersectionObserverInit
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasTriggered.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasTriggered.current) {
            hasTriggered.current = true;
            callback();
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px', threshold: 0.1, ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [callback, options]);

  return elementRef;
}
