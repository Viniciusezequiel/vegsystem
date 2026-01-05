import { useState, useEffect, useRef, memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLostItemImage } from '@/hooks/useLostItemImage';

interface LazyItemImageProps {
  itemId: string;
  alt: string;
  className?: string;
}

/**
 * Lazy-loading image component for lost items.
 * Uses IntersectionObserver to only fetch images when they enter the viewport.
 * Images are fetched separately to avoid database timeouts from large base64 data.
 */
export const LazyItemImage = memo(function LazyItemImage({ 
  itemId,
  alt, 
  className 
}: LazyItemImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe when component enters viewport
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Fallback for environments where IntersectionObserver isn't available
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Only fetch image when visible
  const { data: imageUrl, isLoading } = useLostItemImage(itemId, isVisible);

  const showImage = imageUrl && !hasError;

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted flex items-center justify-center overflow-hidden',
        className
      )}
      title={alt}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
          decoding="async"
        />
      ) : isLoading && isVisible ? (
        <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" />
      ) : (
        <Package className="w-8 h-8 text-muted-foreground/50" />
      )}
    </div>
  );
});
