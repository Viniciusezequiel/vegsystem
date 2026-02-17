import { LostItem } from '@/hooks/useLostItems';
import { Loader2 } from 'lucide-react';

interface Props {
  items?: LostItem[];
  isSelectionMode?: boolean;
  selectedItems?: string[];
  onItemClick: (item: LostItem) => void;
  onToggleSelection?: (id: string) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function VirtualizedItemsList({
  items = [],
  isSelectionMode = false,
  selectedItems = [],
  onItemClick,
  onToggleSelection,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage
}: Props) {

  // 🛡 GARANTIA ABSOLUTA
  const safeItems = Array.isArray(items) ? items : [];

  if (!safeItems.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {safeItems.map((item) => (
        <div
          key={item.id}
          className="p-4 border rounded cursor-pointer hover:bg-muted/40"
          onClick={() => onItemClick(item)}
        >
          <div className="font-medium">{item.title}</div>
          <div className="text-sm text-muted-foreground">
            {item.status}
          </div>
        </div>
      ))}

      {hasNextPage && (
        <div className="flex justify-center py-4">
          <button
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2"
          >
            {isFetchingNextPage && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
