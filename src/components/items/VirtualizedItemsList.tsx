import { memo, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LazyItemImage } from '@/components/items/LazyItemImage';
import { MapPin, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { LostItem } from '@/hooks/useLostItems';

interface VirtualizedItemsListProps {
  items: LostItem[];
  isSelectionMode: boolean;
  selectedItems: string[];
  onItemClick: (item: LostItem) => void;
  onToggleSelection: (id: string) => void;
}

const ITEM_HEIGHT = 156; // Height of each item card
const GAP = 16;

export const VirtualizedItemsList = memo(function VirtualizedItemsList({
  items,
  isSelectionMode,
  selectedItems,
  onItemClick,
  onToggleSelection,
}: VirtualizedItemsListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  // Update column count based on container width
  useEffect(() => {
    const updateColumnCount = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        // 2 columns for lg screens (1024px+), 1 column otherwise
        setColumnCount(width >= 1024 ? 2 : 1);
      }
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ITEM_HEIGHT + GAP,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={containerRef}
      className="w-full overflow-auto"
      style={{ height: Math.min(800, window.innerHeight - 300) }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = items.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex gap-4 px-1"
            >
              {rowItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "item-card cursor-pointer relative flex-1",
                    isSelectionMode && selectedItems.includes(item.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => onItemClick(item)}
                >
                  {isSelectionMode && item.status === 'expired' && (
                    <div className="absolute top-2 right-2 z-10">
                      <Checkbox
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => onToggleSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <LazyItemImage 
                      itemId={item.id}
                      alt={item.description}
                      className="w-24 h-24 rounded-lg flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">{item.code}</p>
                          <h3 className="font-medium text-foreground mt-1 line-clamp-2">
                            {item.description}
                          </h3>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                          <span className="truncate font-medium text-primary">{item.campus}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{item.found_location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(item.found_date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {/* Fill empty space if less items than columns */}
              {rowItems.length < columnCount && (
                <div className="flex-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
