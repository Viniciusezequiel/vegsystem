import { useState, memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyItemImageProps {
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

/**
 * Optimized image component for lost items list.
 * Only renders actual images for Storage URLs (http/https).
 * Base64 images are too large and would slow down the list, so we show a placeholder.
 * Use "Otimizar Imagens" to migrate base64 to Storage URLs.
 */
export const LazyItemImage = memo(function LazyItemImage({ 
  imageUrl, 
  alt, 
  className 
}: LazyItemImageProps) {
  const [hasError, setHasError] = useState(false);
  
  // Only show image if it's a URL (not base64) to avoid performance issues
  const isValidUrl = imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
  const showImage = isValidUrl && !hasError;

  return (
    <div
      className={cn(
        'bg-muted flex items-center justify-center overflow-hidden',
        className
      )}
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
      ) : (
        <Package className="w-8 h-8 text-muted-foreground/50" />
      )}
    </div>
  );
});
