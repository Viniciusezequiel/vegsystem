import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyItemImageProps {
  itemId: string;
  alt: string;
  className?: string;
}

export function LazyItemImage({ itemId, alt, className }: LazyItemImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  const fetchImage = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const { data, error } = await supabase
        .from('lost_items')
        .select('image_url')
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      setImageUrl(data?.image_url || null);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchImage();
          observer.disconnect();
        }
      },
      { rootMargin: '200px', threshold: 0.01 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchImage]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted flex items-center justify-center overflow-hidden',
        className
      )}
    >
      {isLoading && (
        <div className="animate-pulse bg-muted-foreground/20 w-full h-full" />
      )}
      {!isLoading && imageUrl && !hasError && (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
      {!isLoading && (!imageUrl || hasError) && (
        <Package className="w-8 h-8 text-muted-foreground/50" />
      )}
    </div>
  );
}
