import { LostItem } from '@/hooks/useLostItems';
import { Loader2, MapPin, Calendar } from 'lucide-react';

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
  onItemClick,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage
}: Props) {

  const safeItems = Array.isArray(items) ? items : [];

  if (!safeItems.length) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {safeItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onItemClick(item)}
            className="bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
          >
            {/* IMAGEM */}
            <div className="h-48 bg-muted flex items-center justify-center">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.description}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-muted-foreground text-sm">
                  Sem imagem
                </span>
              )}
            </div>

            {/* CONTEÚDO */}
            <div className="p-4 space-y-3">

              {/* TÍTULO + STATUS */}
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg">
                  {item.description ?? 'Sem descrição'}
                </h3>

                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    item.status === 'available'
                      ? 'bg-green-100 text-green-700'
                      : item.status === 'delivered'
                      ? 'bg-gray-200 text-gray-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {item.status === 'available'
                    ? 'Disponível'
                    : item.status === 'delivered'
                    ? 'Entregue'
                    : 'Expirado'}
                </span>
              </div>

              {/* CAMPUS */}
              {item.campus && (
                <div className="text-xs font-medium text-purple-600 bg-purple-100 inline-block px-2 py-1 rounded">
                  {item.campus}
                </div>
              )}

              {/* LOCAL */}
              {item.found_location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {item.found_location}
                </div>
              )}

              {/* DATA */}
              {item.created_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {new Date(item.created_at).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center py-6">
          <button
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
            className="flex items-center gap-2 text-sm"
          >
            {isFetchingNextPage && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Carregar mais
          </button>
        </div>
      )}
    </>
  );
}
