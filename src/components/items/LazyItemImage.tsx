import { useState, useEffect, useRef } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBatchedImage } from '@/hooks/useImageBatch';

interface LazyItemImageProps {
  itemId: string;
  alt: string;
  className?: string;
}

export function LazyItemImage({ itemId, alt, className }: LazyItemImageProps) {
  const { imageUrl, isLoading, requestImage } = useBatchedImage(itemId);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Larger rootMargin to preload earlier (500px)
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          requestImage();
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '500px', threshold: 0.01 }
    );

    observerRef.current.observe(element);
    return () => observerRef.current?.disconnect();
  }, [requestImage]);

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
          loading="eager"
        />
      )}
      {!isLoading && (!imageUrl || hasError) && (
        <Package className="w-8 h-8 text-muted-foreground/50" />
      )}
    </div>
  );
}