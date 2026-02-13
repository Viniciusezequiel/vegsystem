import { memo, useRef, useEffect, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LazyItemImage } from '@/components/items/LazyItemImage';
import { MapPin, Calendar, Building2, Loader2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { LostItem } from '@/hooks/useLostItems';

interface VirtualizedItemsListProps {
  items?: LostItem[];
  isSelectionMode: boolean;
  selectedItems?: string[];
  onItemClick: (item: LostItem) => void;
  onToggleSelection: (id: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

const ITEM_HEIGHT = 148;
const GAP = 16;

/* ============================
   Item Card
============================ */

const ItemCard = memo(function ItemCard({
  item,
  isSelectionMode,
  isSelected,
  onItemClick,
  onToggleSelection,
}: {
  item: LostItem;
  isSelectionMode: boolean;
  isSelected: boolean;
  onItemClick: (item: LostItem) => void;
  onToggleSelection: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "item-card cursor-pointer relative h-full",
        isSelectionMode && isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onItemClick(item)}
    >
      {isSelectionMode && item?.status === 'expired' && (
        <div className="absolute top-2 right-2 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(item.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex gap-4">
        <LazyItemImage 
          itemId={item.id}
          alt={item?.description ?? ''}
          className="w-24 h-24 rounded-lg flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono text-muted-foreground">
                {item?.code ?? '-'}
              </p>
              <h3 className="font-medium text-foreground mt-1 line-clamp-2">
                {item?.description ?? 'Sem descrição'}
              </h3>
            </div>
            <StatusBadge status={item?.status} />
          </div>

          <div className="mt-2 space-y-0.5">
            {item?.campus && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate font-medium text-primary">
                  {item.campus}
                </span>
              </div>
            )}

            {item?.found_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{item.found_location}</span>
              </div>
            )}

            {item?.found_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  {format(
                    new Date(item.found_date + 'T00:00:00'),
                    "dd 'de' MMM",
                    { locale: ptBR }
                  )}
                </span>
              </div>
            )}

            {item?.box_number && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Caixa {item.box_number}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ============================
   Virtualized List
============================ */

export const VirtualizedItemsList = memo(function VirtualizedItemsList({
  items = [],
  isSelectionMode,
  selectedItems = [],
  onItemClick,
  onToggleSelection,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: VirtualizedItemsListProps) {

  const safeItems = Array.isArray(items) ? items : [];
  const safeSelected = Array.isArray(selectedItems) ? selectedItems : [];

  const listRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(2);

  /* Responsive columns */
  useEffect(() => {
    const updateColumnCount = () => {
      setColumnCount(window.innerWidth >= 768 ? 2 : 1);
    };

    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  const rowCount = Math.ceil(safeItems.length / columnCount);

  const virtualizer = useWindowVirtualizer({
    count: rowCount + (hasNextPage ? 1 : 0),
    estimateSize: () => ITEM_HEIGHT + GAP,
    overscan: 5,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const virtualRows = virtualizer.getVirtualItems() ?? [];

  /* Infinite Scroll */
  useEffect(() => {
    if (!Array.isArray(virtualRows) || virtualRows.length === 0) return;

    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= rowCount &&
      hasNextPage &&
      !isFetchingNextPage &&
      typeof fetchNextPage === 'function'
    ) {
      fetchNextPage();
    }
  }, [virtualRows, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={listRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {(virtualRows ?? []).map((virtualRow) => {
          const isLoaderRow = virtualRow.index >= rowCount;

          if (isLoaderRow) {
            return (
              <div
                key="loader"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${
                    virtualRow.start - (virtualizer.options.scrollMargin ?? 0)
                  }px)`,
                }}
                className="flex items-center justify-center"
              >
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Carregando mais itens...</span>
                  </div>
                )}
              </div>
            );
          }

          const startIndex = virtualRow.index * columnCount;
          const rowItems = safeItems.slice(
            startIndex,
            startIndex + columnCount
          );

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${
                  virtualRow.start - (virtualizer.options.scrollMargin ?? 0)
                }px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                gap: `${GAP}px`,
                paddingBottom: `${GAP}px`,
              }}
            >
              {rowItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isSelectionMode={isSelectionMode}
                  isSelected={safeSelected.includes(item.id)}
                  onItemClick={onItemClick}
                  onToggleSelection={onToggleSelection}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});
