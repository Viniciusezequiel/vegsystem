import { useState, memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyItemImageProps {
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

/**
 * Optimized image component that renders directly from the provided URL.
 * No extra fetching - expects image_url to be loaded with the item data.
 */
export const LazyItemImage = memo(function LazyItemImage({ 
  imageUrl, 
  alt, 
  className 
}: LazyItemImageProps) {
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={cn(
        'bg-muted flex items-center justify-center overflow-hidden',
        className
      )}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Package className="w-8 h-8 text-muted-foreground/50" />
      )}
    </div>
  );
});
