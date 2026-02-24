import { useState, useMemo, useEffect } from 'react';
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
import { ptBR } from 'date-fns/locale';
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
import { supabase } from '@/integrations/supabase/client';
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
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('lostItems_search') || '');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>(() => (sessionStorage.getItem('lostItems_status') as ItemStatus | 'all') || 'available');
  const [campusFilter, setCampusFilter] = useState<CampusEnum | 'all'>(() => (sessionStorage.getItem('lostItems_campus') as CampusEnum | 'all') || 'all');
  const [destinationFilter, setDestinationFilter] = useState<'all' | 'donation' | 'disposal'>(() => (sessionStorage.getItem('lostItems_destination') as 'all' | 'donation' | 'disposal') || 'all');
  const [dateFrom, setDateFrom] = useState(() => sessionStorage.getItem('lostItems_dateFrom') || '');
  const [dateTo, setDateTo] = useState(() => sessionStorage.getItem('lostItems_dateTo') || '');
  
  
  // Filter status options based on user role
  const availableStatusFilters = statusFilters.filter(filter => {
    if (!filter.restrictedRoles) return true;
    return filter.restrictedRoles.includes(role || '');
  });
  
  // Selection state
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

  const handleMigrateAllImages = async () => {
    setIsMigratingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke('migrate-all-images');
      
      if (error) throw error;
      
      if (data.migrated > 0) {
        toast({
          title: 'Migração concluída!',
          description: `${data.migrated} imagens migradas com sucesso. ${data.failed > 0 ? `${data.failed} falharam.` : ''}`,
        });
        // Force reload to show new URLs
        window.location.reload();
      } else if (data.failed > 0) {
        toast({
          title: 'Erro na migração',
          description: `${data.failed} imagens falharam ao migrar.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Nenhuma imagem para migrar',
          description: 'Todas as imagens já estão otimizadas.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao migrar imagens',
        variant: 'destructive',
      });
    } finally {
      setIsMigratingImages(false);
    }
  };

  const { 
    data, 
    isLoading, 
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

  // Flatten all pages into a single array
  const filteredItems = useMemo(() => {
    return data?.pages.flatMap(page => page.items) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  // Filter change handlers (no page reset needed with infinite scroll)
  const handleStatusFilterChange = (value: ItemStatus | 'all') => {
    setStatusFilter(value);
    sessionStorage.setItem('lostItems_status', value);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    sessionStorage.setItem('lostItems_search', value);
  };

  const handleCampusFilterChange = (value: CampusEnum | 'all') => {
    setCampusFilter(value);
    sessionStorage.setItem('lostItems_campus', value);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    sessionStorage.setItem('lostItems_dateFrom', value);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    sessionStorage.setItem('lostItems_dateTo', value);
  };

  const handleDestinationFilterChange = (value: 'all' | 'donation' | 'disposal') => {
    setDestinationFilter(value);
    sessionStorage.setItem('lostItems_destination', value);
  };

  // Get expired items for bulk actions
  const expiredItems = useMemo(() => {
    return filteredItems.filter(item => item.status === 'expired');
  }, [filteredItems]);

  const handleItemClick = (item: LostItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
    } else {
      navigate(`/items/${item.id}`);
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

  const handleBulkAction = async (destination: 'donation' | 'disposal') => {
    if (selectedItems.length === 0) return;
    
    await bulkDeliver.mutateAsync({
      ids: selectedItems,
      destination,
    });
    
    setSelectedItems([]);
    setIsSelectionMode(false);
    setBulkActionDialog(null);
  };

  const exportToPDF = async () => {
    try {
      // Build filters list
      const appliedFilters: string[] = [];
      appliedFilters.push(`Status: ${statusFilter === 'all' ? 'Todos' : statusFilters.find(f => f.value === statusFilter)?.label}`);
      if (campusFilter !== 'all') appliedFilters.push(`Campus: ${campusFilter}`);
      if (dateFrom) appliedFilters.push(`De: ${format(new Date(dateFrom), 'dd/MM/yyyy')}`);
      if (dateTo) appliedFilters.push(`Até: ${format(new Date(dateTo), 'dd/MM/yyyy')}`);

      await generatePdf({
        title: 'Relatório de Achados e Perdidos',
        columns: [
          { header: 'Código', accessor: 'code' },
          { header: 'Descrição', accessor: (row) => row.description.substring(0, 40) + (row.description.length > 40 ? '...' : '') },
          { header: 'Campus', accessor: 'campus' },
          { header: 'Local', accessor: (row) => row.found_location.substring(0, 25) + (row.found_location.length > 25 ? '...' : '') },
          { header: 'Recebido', accessor: (row) => format(new Date(row.received_date + 'T00:00:00'), 'dd/MM/yyyy') },
          { header: 'Status', accessor: (row) => row.status === 'available' ? 'Disponível' : row.status === 'pending' ? 'Pendente' : row.status === 'delivered' ? 'Entregue' : 'Expirado' },
          { header: 'Prateleira', accessor: (row) => row.shelf || '-' },
          { header: 'Caixa', accessor: (row) => row.box || '-' },
        ],
        data: filteredItems,
        filters: appliedFilters,
        filename: 'achados-perdidos',
      });

      toast({
        title: 'PDF gerado',
        description: 'O relatório foi exportado com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar PDF',
        description: error.message || 'Falha ao exportar o relatório.',
        variant: 'destructive',
      });
    }
  };

  // Helper function to parse dates in various formats (DD/MM/YYYY or YYYY-MM-DD)
  const parseDate = (dateValue: any): string => {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    
    // If it's already a valid ISO date string
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
      return dateValue.split('T')[0];
    }
    
    // If it's in DD/MM/YYYY format
    if (typeof dateValue === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
      const [day, month, year] = dateValue.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // If it's an Excel serial date number
    if (typeof dateValue === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    return new Date().toISOString().split('T')[0];
  };

  const downloadTemplate = () => {
    // Create workbook with example data
    const templateData = [
      {
        codigo_item: '123456',
        descricao: 'Carteira preta de couro',
        campus: 'Campus I',
        local: 'Biblioteca Central',
        data_encontrado: format(new Date(), 'dd/MM/yyyy'),
        data_recebido: format(new Date(), 'dd/MM/yyyy'),
        prateleira: 'A1',
        caixa: 'C01',
        lacre: 'L001',
        entregue_por: 'João Silva',
        contato: '(11) 99999-9999',
        situacao_item: 'Disponível'
      },
      {
        codigo_item: '234567',
        descricao: 'Celular Samsung preto',
        campus: 'Campus II',
        local: 'Cantina',
        data_encontrado: format(new Date(), 'dd/MM/yyyy'),
        data_recebido: format(new Date(), 'dd/MM/yyyy'),
        prateleira: 'B2',
        caixa: 'C02',
        lacre: '',
        entregue_por: 'Maria Santos',
        contato: '',
        situacao_item: 'Disponível'
      },
      {
        codigo_item: '345678',
        descricao: 'Óculos de grau',
        campus: 'Campus IV',
        local: 'Sala 101',
        data_encontrado: format(new Date(), 'dd/MM/yyyy'),
        data_recebido: format(new Date(), 'dd/MM/yyyy'),
        prateleira: '',
        caixa: '',
        lacre: '',
        entregue_por: 'Pedro Oliveira',
        contato: 'pedro@email.com',
        situacao_item: 'Disponível'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // codigo_item
      { wch: 30 }, // descricao
      { wch: 15 }, // campus
      { wch: 20 }, // local
      { wch: 15 }, // data_encontrado
      { wch: 15 }, // data_recebido
      { wch: 12 }, // prateleira
      { wch: 10 }, // caixa
      { wch: 10 }, // lacre
      { wch: 20 }, // entregue_por
      { wch: 18 }, // contato
      { wch: 12 }, // situacao_item
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo');
    
    XLSX.writeFile(workbook, 'modelo-achados-perdidos.xlsx');
    
    toast({
      title: 'Modelo baixado',
      description: 'O arquivo modelo foi baixado com sucesso. Preencha e importe.',
    });
  };

  // Map status from spreadsheet to system status
  const mapStatus = (status: string): string => {
    if (!status) return 'available';
    const normalized = status.toLowerCase().trim();
    if (normalized === 'baixado' || normalized === 'entregue' || normalized === 'delivered') {
      return 'delivered';
    }
    if (normalized === 'expirado' || normalized === 'expired') {
      return 'expired';
    }
    return 'available';
  };

  // Map campus from spreadsheet to valid enum
  const mapCampus = (campus: string): CampusEnum => {
    if (!campus) return 'Campus I';
    const normalized = campus.toLowerCase().trim();
    if (normalized.includes('campus 2') || normalized.includes('campus ii') || normalized === 'campus ii') {
      return 'Campus II';
    }
    if (normalized.includes('campus 4') || normalized.includes('campus iv') || normalized === 'campus iv') {
      return 'Campus IV';
    }
    if (normalized.includes('hucm') || normalized.includes('adm')) {
      return 'Campus HUCM Adm';
    }
    return 'Campus I';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      // Map columns to expected format - now including codigo_item
      const mappedData = jsonData.map((row: any) => ({
        code: row.codigo_item || row.codigo || row.Codigo || row.CODIGO || row.code || `AP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        description: row.descricao || row.Descricao || row.DESCRICAO || row.description || '',
        campus: mapCampus(row.campus || row.Campus || row.CAMPUS || 'Campus I'),
        found_location: row.local || row.Local || row.LOCAL || row.found_location || 'Não informado',
        found_date: parseDate(row.data_encontrado || row.found_date),
        received_date: parseDate(row.data_recebido || row.received_date),
        shelf: row.prateleira || row.shelf || null,
        box: row.caixa || row.box || null,
        seal_number: row.lacre || row.seal_number || null,
        delivered_by_name: row.entregue_por || row.delivered_by_name || 'Importação',
        delivered_by_contact: row.contato || row.delivered_by_contact || null,
        status: mapStatus(row.situacao_item || row.status),
      }));

      setImportData(mappedData);
      setImportPreview(mappedData.slice(0, 5));
      setImportDialog(true);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (importData.length === 0) return;

    await bulkCreate.mutateAsync({ items: importData, replaceExisting });
    setImportDialog(false);
    setImportData([]);
    setImportPreview([]);
    setReplaceExisting(false);
  };

  return (
    <MainLayout>
      <div className="page-header">
        <h1 className="page-title">Buscar Itens</h1>
        <p className="page-subtitle">Pesquise e visualize os itens cadastrados</p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, descrição ou local..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={campusFilter} onValueChange={(v) => handleCampusFilterChange(v as CampusEnum | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Campus" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Campus</SelectItem>
              {campusOptions.map(campus => (
                <SelectItem key={campus} value={campus}>{campus}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 items-center">
            <DatePickerInput
              value={dateFrom}
              onChange={handleDateFromChange}
              placeholder="De"
              className="w-[130px]"
            />
            <span className="text-muted-foreground">-</span>
            <DatePickerInput
              value={dateTo}
              onChange={handleDateToChange}
              placeholder="Até"
              className="w-[130px]"
            />
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || campusFilter !== 'all' || statusFilter !== 'available' || destinationFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setCampusFilter('all');
                setStatusFilter('available');
                setDestinationFilter('all');
                setDateFrom('');
                setDateTo('');
                sessionStorage.removeItem('lostItems_search');
                sessionStorage.removeItem('lostItems_status');
                sessionStorage.removeItem('lostItems_campus');
                sessionStorage.removeItem('lostItems_destination');
                sessionStorage.removeItem('lostItems_dateFrom');
                sessionStorage.removeItem('lostItems_dateTo');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
          {availableStatusFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilterChange(filter.value)}
              className={cn(
                'transition-all',
                statusFilter === filter.value && 'shadow-md'
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {/* Destination Filter (for "Todos" status) */}
        {statusFilter === 'all' && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Destino:</span>
            <Button
              variant={destinationFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDestinationFilterChange('all')}
            >
              Todos
            </Button>
            <Button
              variant={destinationFilter === 'donation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDestinationFilterChange('donation')}
              className="gap-1"
            >
              <Gift className="w-4 h-4" />
              Doação
            </Button>
            <Button
              variant={destinationFilter === 'disposal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDestinationFilterChange('disposal')}
              className="gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Descarte
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {/* Export/Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="w-4 h-4 mr-2" />
                Exportar/Importar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-popover border shadow-md z-50">
              <DropdownMenuItem onClick={exportToPDF} disabled={filteredItems.length === 0}>
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadTemplate}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Baixar Modelo Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <label className="flex items-center cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Itens
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkImageDialog(true)}>
                <ImageIcon className="w-4 h-4 mr-2" />
                Upload Imagens em Lote
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Admin Actions Dropdown */}
          {role === 'admin' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="w-4 h-4 mr-2" />
                  Ações Admin
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover border shadow-md z-50">
                <DropdownMenuItem 
                  onClick={handleMigrateAllImages}
                  disabled={isMigratingImages}
                >
                  {isMigratingImages ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Otimizar Imagens
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/lost-found/archived')}>
                  <Archive className="w-4 h-4 mr-2" />
                  Ver Arquivados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setArchiveDeliveredDialog(true)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Arquivar Entregues
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStorageConfigDialog(true)}>
                  <Package className="w-4 h-4 mr-2" />
                  Configurar Prateleiras/Caixas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Expired Items Selection Mode */}
          {statusFilter === 'expired' && expiredItems.length > 0 && (
            <>
              {isSelectionMode ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedItems([]);
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    {selectedItems.length === expiredItems.length ? 'Desmarcar' : 'Selecionar'} Todos
                  </Button>
                  {selectedItems.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary">
                          <MoreHorizontal className="w-4 h-4 mr-2" />
                          Ações ({selectedItems.length})
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-popover border shadow-md z-50">
                        <DropdownMenuItem onClick={() => setBulkActionDialog('donation')}>
                          <Gift className="w-4 h-4 mr-2" />
                          Enviar para Doação
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setBulkActionDialog('disposal')}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Enviar para Descarte
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Selecionar Itens
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !filteredItems || filteredItems.length === 0 ? (
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
            items={filteredItems}
            isSelectionMode={isSelectionMode}
            selectedItems={selectedItems}
            onItemClick={handleItemClick}
            onToggleSelection={toggleItemSelection}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
          />
      </>
    )}

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={!!bulkActionDialog} onOpenChange={() => setBulkActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkActionDialog === 'donation' ? 'Confirmar Doação' : 'Confirmar Descarte'}
            </DialogTitle>
            <DialogDescription>
              {selectedItems.length} item(ns) será(ão) marcado(s) como {bulkActionDialog === 'donation' ? 'doado(s)' : 'descartado(s)'}.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialog(null)}>
              Cancelar
            </Button>
            <Button 
              variant={bulkActionDialog === 'disposal' ? 'destructive' : 'default'}
              onClick={() => handleBulkAction(bulkActionDialog!)}
              disabled={bulkDeliver.isPending}
            >
              {bulkDeliver.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : bulkActionDialog === 'donation' ? (
                <Gift className="w-4 h-4 mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog} onOpenChange={setImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Itens</DialogTitle>
            <DialogDescription>
              {importData.length} item(ns) encontrado(s) no arquivo. Confira a prévia abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2 text-left">Código</th>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Campus</th>
                  <th className="p-2 text-left">Local</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((item, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2 font-mono text-xs">{item.code}</td>
                    <td className="p-2 truncate max-w-[200px]">{item.description}</td>
                    <td className="p-2">{item.campus}</td>
                    <td className="p-2 truncate max-w-[150px]">{item.found_location}</td>
                  </tr>
                ))}
                {importData.length > 5 && (
                  <tr className="border-t bg-muted/50">
                    <td colSpan={4} className="p-2 text-center text-muted-foreground">
                      ... e mais {importData.length - 5} item(ns)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Checkbox 
              id="replaceExisting" 
              checked={replaceExisting}
              onCheckedChange={(checked) => setReplaceExisting(checked === true)}
            />
            <Label htmlFor="replaceExisting" className="text-sm cursor-pointer">
              Substituir itens existentes com mesmo código (duplicados serão atualizados)
            </Label>
          </div>
          
          <p className="text-xs text-muted-foreground">
            O arquivo deve conter colunas como: codigo, descricao, campus, local, data_encontrado, data_recebido, prateleira, caixa, lacre, entregue_por
          </p>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={bulkCreate.isPending}>
              {bulkCreate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importar {importData.length} Item(ns)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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