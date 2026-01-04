import { memo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LazyItemImageProps {
  imageUrl?: string | null;
  alt: string;
  className?: string;
}

/**
 * Simple image placeholder component.
 * Due to base64 images causing database timeouts, we show a placeholder in the list.
 * Full images are shown only when viewing item details.
 * Use "Otimizar Imagens" button to migrate base64 to Storage URLs.
 */
export const LazyItemImage = memo(function LazyItemImage({ 
  alt, 
  className 
}: LazyItemImageProps) {
  return (
    <div
      className={cn(
        'bg-muted flex items-center justify-center overflow-hidden',
        className
      )}
    >
      <Package className="w-8 h-8 text-muted-foreground/50" />
    </div>
  );
});
