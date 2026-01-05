import { memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyItemImageProps {
  alt: string;
  className?: string;
}

/**
 * Simple placeholder component for lost items list.
 * Images are excluded from the main query to prevent database timeouts caused by large base64 data.
 * To enable image display in the list, use "Otimizar Imagens" to migrate base64 to Storage URLs.
 */
export const LazyItemImage = memo(function LazyItemImage({ 
  alt, 
  className 
}: LazyItemImageProps) {
  return (
    <div
      className={cn(
        "bg-muted flex items-center justify-center overflow-hidden",
        className
      )}
      title={alt}
    >
      <Package className="w-8 h-8 text-muted-foreground/50" />
    </div>
  );
});
