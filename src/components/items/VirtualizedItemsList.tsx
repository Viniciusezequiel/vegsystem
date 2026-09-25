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
  items: LostItem[];
  isSelectionMode: boolean;
  selectedItems: string[];
  onItemClick: (item: LostItem) => void;
  onToggleSelection: (id: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

const ITEM_HEIGHT = 182;
const GAP = 12;

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
    <button
      type="button"
      className={cn(
        'group relative h-full w-full overflow-hidden rounded-2xl border border-border/45 bg-card/65 p-3 text-left shadow-[0_16px_42px_-34px_rgba(0,0,0,.9)] backdrop-blur-sm transition duration-200',
        'hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/82 hover:shadow-[0_20px_48px_-34px_hsl(var(--primary)/.55)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
        isSelectionMode && isSelected && 'border-primary/55 ring-2 ring-primary/35'
      )}
      onClick={() => onItemClick(item)}
      aria-label={`${item.description}. Código ${item.code}. ${item.campus}.`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_10%,hsl(var(--primary)/.08),transparent_34%)] opacity-0 transition group-hover:opacity-100" />

      {isSelectionMode && item.status === 'expired' && (
        <div className="absolute right-2.5 top-2.5 z-20">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection(item.id)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Selecionar ${item.description}`}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full gap-3">
        <LazyItemImage
          itemId={item.id}
          storedValue={item.image_url}
          alt={item.description}
          className="h-[86px] w-[86px] shrink-0 rounded-xl border border-border/30 object-cover shadow-sm"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[10px] text-muted-foreground">#{item.code}</p>
              <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-[1.28] text-foreground/95">
                {item.description}
              </h3>
            </div>
            {!isSelectionMode && (
              <div className="shrink-0 scale-[0.88] origin-top-right">
                <StatusBadge status={item.status} />
              </div>
            )}
          </div>

          <div className="mt-auto grid gap-1 pt-2">
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/80" />
              <span className="truncate font-medium text-primary/90">{item.campus}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.found_location}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {format(new Date(`${item.found_date}T00:00:00`), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            {item.box_number && (
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Caixa {item.box_number}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

function getColumnCount(width: number) {
  if (width >= 1180) return 4;
  if (width >= 860) return 3;
  if (width >= 540) return 2;
  return 1;
}

export const VirtualizedItemsList = memo(function VirtualizedItemsList({
  items,
  isSelectionMode,
  selectedItems,
  onItemClick,
  onToggleSelection,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: VirtualizedItemsListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;

    const updateColumns = () => {
      setColumnCount(getColumnCount(element.getBoundingClientRect().width));
    };

    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const rowCount = Math.ceil(items.length / columnCount);

  const virtualizer = useWindowVirtualizer({
    count: rowCount + (hasNextPage ? 1 : 0),
    estimateSize: () => ITEM_HEIGHT + GAP,
    overscan: 6,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= rowCount && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [virtualRows, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={listRef} className="min-w-0 max-w-full">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          maxWidth: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
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
                  transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                }}
                className="flex items-center justify-center"
              >
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando mais itens...</span>
                  </div>
                )}
              </div>
            );
          }

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
                maxWidth: '100%',
                height: `${ITEM_HEIGHT}px`,
                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap: `${GAP}px`,
                paddingBottom: `${GAP}px`,
              }}
            >
              {rowItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedItems.includes(item.id)}
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
