import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Search, Package, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ItemStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useLostItems, LostItem } from '@/hooks/useLostItems';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusFilters: { value: ItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'expired', label: 'Expirados' },
];

export default function ItemsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');

  const { data: items, isLoading } = useLostItems({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
  });

  const handleItemClick = (item: LostItem) => {
    navigate(`/items/${item.id}`);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Buscar Itens</h1>
        <p className="page-subtitle">Pesquise e visualize os itens cadastrados</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, descrição ou local..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 flex-wrap">
          {statusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'transition-all',
                statusFilter === filter.value && 'shadow-md'
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">Nenhum item encontrado</h3>
          <p className="text-muted-foreground mt-1">
            Tente ajustar os filtros ou termo de busca
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {items.length} {items.length === 1 ? 'item encontrado' : 'itens encontrados'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="item-card animate-fade-in cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleItemClick(item)}
              >
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.description}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
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
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{item.found_location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(item.found_date), "dd 'de' MMMM", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </MainLayout>
  );
}
