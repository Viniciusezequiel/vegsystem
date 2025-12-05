import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { ItemCard } from '@/components/items/ItemCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mockItems } from '@/data/mockData';
import { Search, Filter, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ItemStatus, LostItem } from '@/types';
import { cn } from '@/lib/utils';

const statusFilters: { value: ItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'delivered', label: 'Entregues' },
];

export default function ItemsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');

  const filteredItems = mockItems.filter((item) => {
    const matchesSearch = 
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.foundLocation.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
        <div className="flex gap-2">
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
      {filteredItems.length === 0 ? (
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
            {filteredItems.length} {filteredItems.length === 1 ? 'item encontrado' : 'itens encontrados'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <ItemCard item={item} onClick={handleItemClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </MainLayout>
  );
}
