import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Package, Loader2, Search, Settings, Upload, Archive, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/DatePickerInput';

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

const ALL_CAMPUSES: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

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
  const [campusFilter, setCampusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
    campus: campusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const bulkDeliver = useBulkDeliverLostItems();
  const bulkCreate = useBulkCreateLostItems();

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
    if (typeof firstPage?.totalCount === 'number') return firstPage.totalCount;
    return filteredItems.length;
  }, [data, filteredItems]);

  if (error) {
    console.error("Erro ao buscar itens:", error);
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-lg font-semibold text-destructive">Erro ao carregar itens</h2>
          <p className="text-muted-foreground mt-2 text-center max-w-md">
            Verifique a conexão e tente novamente.
          </p>
        </div>
      </MainLayout>
    );
  }

  const handleItemClick = (item: LostItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
    } else {
      navigate(`/lost-found/items/${item.id}`);
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const clearAdvancedFilters = () => {
    setCampusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasAdvancedFilters = !!campusFilter || !!dateFrom || !!dateTo;

  const visibleStatusFilters = statusFilters.filter(filter => {
    if (!filter.restrictedRoles) return true;
    return filter.restrictedRoles.includes(role);
  });

  const isAdminOrAnalista = role === 'admin' || role === 'analista' || role === 'supervisor';

  return (
    <MainLayout>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Buscar Itens</h1>
          <p className="page-subtitle">Pesquise e visualize os itens cadastrados</p>
        </div>

        {isAdminOrAnalista && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setStorageConfigDialog(true)}>
              <Settings className="w-4 h-4 mr-1" />
              Armazenamento
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkImageDialog(true)}>
              <Upload className="w-4 h-4 mr-1" />
              Upload Imagens
            </Button>
            <Button variant="outline" size="sm" onClick={() => setArchiveDeliveredDialog(true)}>
              <Archive className="w-4 h-4 mr-1" />
              Arquivar
            </Button>
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div className="bg-card border rounded-xl p-4 mb-6 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nome, descrição ou código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          {visibleStatusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                statusFilter === filter.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {filter.label}
            </button>
          ))}

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition ${
              hasAdvancedFilters
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {hasAdvancedFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-primary" />
            )}
            {showAdvancedFilters ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Filtros avançados */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Campus</label>
              <Select value={campusFilter} onValueChange={setCampusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os campus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os campus</SelectItem>
                  {ALL_CAMPUSES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
              <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="De" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
              <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="Até" />
            </div>

            {hasAdvancedFilters && (
              <div className="sm:col-span-3">
                <Button variant="ghost" size="sm" onClick={clearAdvancedFilters} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5 mr-1" />
                  Limpar filtros avançados
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONTEÚDO */}
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

      <BulkImageUploadDialog open={bulkImageDialog} onOpenChange={setBulkImageDialog} />
      <ArchiveDeliveredItemsDialog open={archiveDeliveredDialog} onOpenChange={setArchiveDeliveredDialog} />
      <StorageConfigDialog open={storageConfigDialog} onOpenChange={setStorageConfigDialog} />
    </MainLayout>
  );
}
