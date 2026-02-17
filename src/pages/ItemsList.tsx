import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Package,
  Loader2,
  FileDown,
  Gift,
  Trash2,
  Upload,
  X,
  CheckSquare,
  FileSpreadsheet,
  ImageIcon,
  Archive,
  Zap,
  MoreHorizontal,
  Settings2
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { VirtualizedItemsList } from '@/components/items/VirtualizedItemsList';
import { BulkImageUploadDialog } from '@/components/items/BulkImageUploadDialog';
import { ArchiveDeliveredItemsDialog } from '@/components/items/ArchiveDeliveredItemsDialog';
import { StorageConfigDialog } from '@/components/items/StorageConfigDialog';

import { useNavigate } from 'react-router-dom';
import { ItemStatus } from '@/types';
import { cn } from '@/lib/utils';
import { LostItem, useBulkDeliverLostItems, useBulkCreateLostItems } from '@/hooks/useLostItems';
import { useInfiniteLostItems } from '@/hooks/useInfiniteLostItems';
import { format } from 'date-fns';
import { DatePickerInput } from '@/components/ui/DatePickerInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { generatePdf } from '@/lib/pdfService';
import * as XLSX from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const statusFilters: { value: ItemStatus | 'all'; label: string; restrictedRoles?: string[] }[] = [
  { value: 'all', label: 'Todos', restrictedRoles: ['admin', 'analista', 'supervisor'] },
  { value: 'available', label: 'Disponíveis' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'expired', label: 'Expirados', restrictedRoles: ['admin', 'analista', 'supervisor'] },
];

const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function ItemsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('available');
  const [campusFilter, setCampusFilter] = useState<CampusEnum | 'all'>('all');
  const [destinationFilter, setDestinationFilter] = useState<'all' | 'donation' | 'disposal'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const [bulkActionDialog, setBulkActionDialog] = useState<'donation' | 'disposal' | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const [bulkImageDialog, setBulkImageDialog] = useState(false);
  const [archiveDeliveredDialog, setArchiveDeliveredDialog] = useState(false);
  const [storageConfigDialog, setStorageConfigDialog] = useState(false);
  const [isMigratingImages, setIsMigratingImages] = useState(false);

  const availableStatusFilters = statusFilters.filter(filter => {
    if (!filter.restrictedRoles) return true;
    return filter.restrictedRoles.includes(role || '');
  });

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
    campus: campusFilter !== 'all' ? campusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    destination: statusFilter === 'all' ? destinationFilter : undefined,
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


  // 🔒 PROTEÇÃO TOTAL CONTRA UNDEFINED
  const filteredItems = useMemo<LostItem[]>(() => {
    if (!data || !Array.isArray(data.pages)) return [];

    return data.pages.flatMap((page: any) => {
      if (!page || !Array.isArray(page.items)) return [];
      return page.items;
    });
  }, [data]);

  const totalCount =
    data &&
    Array.isArray(data.pages) &&
    data.pages.length > 0 &&
    typeof data.pages[0]?.totalCount === 'number'
      ? data.pages[0].totalCount
      : 0;

  const expiredItems = useMemo(() => {
    return filteredItems.filter(item => item.status === 'expired');
  }, [filteredItems]);

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

  const toggleSelectAll = () => {
    if (selectedItems.length === expiredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(expiredItems.map(i => i.id));
    }
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Buscar Itens</h1>
        <p className="page-subtitle">Pesquise e visualize os itens cadastrados</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !Array.isArray(filteredItems) || filteredItems.length === 0 ? (
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
            {isSelectionMode && ` | ${selectedItems.length} selecionado(s)`}
          </p>

          <VirtualizedItemsList
            items={Array.isArray(filteredItems) ? filteredItems : []}
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
