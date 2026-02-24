import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Package, Loader2, Search } from 'lucide-react';

import { VirtualizedItemsList } from '@/components/items/VirtualizedItemsList';
import { BulkImageUploadDialog } from '@/components/items/BulkImageUploadDialog';
import { ArchiveDeliveredItemsDialog } from '@/components/items/ArchiveDeliveredItemsDialog';
import { StorageConfigDialog } from '@/components/items/StorageConfigDialog';

import { useNavigate } from 'react-router-dom';
import { ItemStatus } from '@/types';
import { LostItem, useBulkDeliverLostItems, useBulkCreateLostItems } from '@/hooks/useLostItems';
import { useInfiniteLostItems } from '@/hooks/useInfiniteLostItems';

import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const statusFilters: { value: ItemStatus | 'all'; label: string; restrictedRoles?: string[] }[] = [
  { value: 'all', label: 'Todos', restrictedRoles: ['admin', 'analista', 'supervisor'] },
  { value: 'available', label: 'Disponíveis' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'expired', label: 'Expirados', restrictedRoles: ['admin', 'analista', 'supervisor'] },
];

export default function ItemsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('available');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [bulkImageDialog, setBulkImageDialog] = useState(false);
  const [archiveDeliveredDialog, setArchiveDeliveredDialog] = useState(false);
  const [storageConfigDialog, setStorageConfigDialog] = useState(false);

  const {
    data,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage
  } = useInfiniteLostItems({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
  });

  const bulkDeliver = useBulkDeliverLostItems();
  const bulkCreate = useBulkCreateLostItems();

  if (error) {
    console.error("Erro ao buscar itens:", error);

    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-lg font-semibold text-red-600">
            Erro ao carregar itens
          </h2>
          <p className="text-muted-foreground mt-2 text-center max-w-md">
            Verifique se a tabela <strong>lost_items</strong> existe no Supabase
            e se as políticas RLS estão configuradas corretamente.
          </p>
        </div>
      </MainLayout>
    );
  }

  const filteredItems = useMemo<LostItem[]>(() => {
    if (!data?.pages || !Array.isArray(data.pages)) return [];

    return data.pages.flatMap((page: any) => {
      if (!page) return [];
      if (Array.isArray(page.items)) return page.items;
      if (Array.isArray(page.data)) return page.data;
      return [];
    });
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data?.pages?.length) return 0;

    const firstPage = data.pages[0];
    if (typeof firstPage?.totalCount === 'number') {
      return firstPage.totalCount;
    }

    return filteredItems.length;
  }, [data, filteredItems]);

  const handleItemClick = (item: LostItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
    } else {
      navigate(`/lost-found/items/${item.id}`);
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const visibleStatusFilters = statusFilters.filter(filter => {
    if (!filter.restrictedRoles) return true;
    return filter.restrictedRoles.includes(role);
  });

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Buscar Itens</h1>
        <p className="page-subtitle">Pesquise e visualize os itens cadastrados</p>
      </div>

      {/* ===== FILTROS ===== */}
      <div className="bg-card border rounded-xl p-4 mb-6 space-y-4">

        {/* Campo de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filtros de status */}
        <div className="flex flex-wrap gap-2">
          {visibleStatusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                statusFilter === filter.value
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      {/* ===== FIM FILTROS ===== */}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
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
            {totalCount} {totalCount === 1 ? 'item encontrado' : 'itens encontrados'}
          </p>

          <VirtualizedItemsList
            items={filteredItems}
            isSelectionMode={isSelectionMode}
            selectedItems={selectedItems}
            onItemClick={handleItemClick}
            onToggleSelection={toggleItemSelection}
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={!!isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
        </>
      )}

      <BulkImageUploadDialog
        open={bulkImageDialog}
        onOpenChange={setBulkImageDialog}
      />

      <ArchiveDeliveredItemsDialog
        open={archiveDeliveredDialog}
        onOpenChange={setArchiveDeliveredDialog}
      />

      <StorageConfigDialog
        open={storageConfigDialog}
        onOpenChange={setStorageConfigDialog}
      />
    </MainLayout>
  );
}
