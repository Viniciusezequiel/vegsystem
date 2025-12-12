import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Package, 
  MapPin, 
  Calendar, 
  Loader2, 
  Building2, 
  FileDown, 
  Gift, 
  Trash2, 
  Upload,
  X,
  CheckSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ItemStatus } from '@/types';
import { cn } from '@/lib/utils';
import { useLostItems, LostItem, useBulkDeliverLostItems, useBulkCreateLostItems } from '@/hooks/useLostItems';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Database } from '@/integrations/supabase/types';

type CampusEnum = Database['public']['Enums']['campus_enum'];

const statusFilters: { value: ItemStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponíveis' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'expired', label: 'Expirados' },
];

const campusOptions: CampusEnum[] = ['Campus I', 'Campus II', 'Campus IV', 'Campus HUCM Adm'];

export default function ItemsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all');
  const [campusFilter, setCampusFilter] = useState<CampusEnum | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkActionDialog, setBulkActionDialog] = useState<'donation' | 'disposal' | null>(null);
  const [importDialog, setImportDialog] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  const { data: items, isLoading } = useLostItems({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
  });

  const bulkDeliver = useBulkDeliverLostItems();
  const bulkCreate = useBulkCreateLostItems();

  // Apply additional filters
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    return items.filter(item => {
      // Campus filter
      if (campusFilter !== 'all' && item.campus !== campusFilter) {
        return false;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const receivedDate = new Date(item.received_date);
        if (dateFrom && receivedDate < startOfDay(new Date(dateFrom))) {
          return false;
        }
        if (dateTo && receivedDate > endOfDay(new Date(dateTo))) {
          return false;
        }
      }

      return true;
    });
  }, [items, campusFilter, dateFrom, dateTo]);

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

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Relatório de Achados e Perdidos', 14, 22);
    
    // Filter info
    doc.setFontSize(10);
    let filterText = `Status: ${statusFilter === 'all' ? 'Todos' : statusFilters.find(f => f.value === statusFilter)?.label}`;
    if (campusFilter !== 'all') filterText += ` | Campus: ${campusFilter}`;
    if (dateFrom) filterText += ` | De: ${format(new Date(dateFrom), 'dd/MM/yyyy')}`;
    if (dateTo) filterText += ` | Até: ${format(new Date(dateTo), 'dd/MM/yyyy')}`;
    doc.text(filterText, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);
    
    // Table data
    const tableData = filteredItems.map(item => [
      item.code,
      item.description.substring(0, 40) + (item.description.length > 40 ? '...' : ''),
      item.campus,
      item.found_location.substring(0, 25) + (item.found_location.length > 25 ? '...' : ''),
      format(new Date(item.received_date), 'dd/MM/yyyy'),
      item.status === 'available' ? 'Disponível' :
      item.status === 'pending' ? 'Pendente' :
      item.status === 'delivered' ? 'Entregue' : 'Expirado',
      item.shelf || '-',
      item.box || '-',
    ]);
    
    autoTable(doc, {
      head: [['Código', 'Descrição', 'Campus', 'Local', 'Recebido', 'Status', 'Prateleira', 'Caixa']],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`achados-perdidos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({
      title: 'PDF gerado',
      description: 'O relatório foi exportado com sucesso.',
    });
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
      
      // Map columns to expected format
      const mappedData = jsonData.map((row: any) => ({
        code: row.codigo || row.Codigo || row.CODIGO || row.code || `AP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        description: row.descricao || row.Descricao || row.DESCRICAO || row.description || '',
        campus: (row.campus || row.Campus || row.CAMPUS || 'Campus I') as CampusEnum,
        found_location: row.local || row.Local || row.LOCAL || row.found_location || 'Não informado',
        found_date: row.data_encontrado || row.found_date || new Date().toISOString().split('T')[0],
        received_date: row.data_recebido || row.received_date || new Date().toISOString().split('T')[0],
        shelf: row.prateleira || row.shelf || null,
        box: row.caixa || row.box || null,
        seal_number: row.lacre || row.seal_number || null,
        delivered_by_name: row.entregue_por || row.delivered_by_name || 'Importação',
        delivered_by_contact: row.contato || row.delivered_by_contact || null,
        status: row.status || 'available',
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

    await bulkCreate.mutateAsync(importData);
    setImportDialog(false);
    setImportData([]);
    setImportPreview([]);
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={campusFilter} onValueChange={(v) => setCampusFilter(v as CampusEnum | 'all')}>
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
              onChange={setDateFrom}
              placeholder="De"
              className="w-[130px]"
            />
            <span className="text-muted-foreground">-</span>
            <DatePickerInput
              value={dateTo}
              onChange={setDateTo}
              placeholder="Até"
              className="w-[130px]"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2">
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

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF} disabled={filteredItems.length === 0}>
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Importar Itens
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </span>
            </Button>
          </label>

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
                    {selectedItems.length === expiredItems.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </Button>
                  {selectedItems.length > 0 && (
                    <>
                      <Button 
                        size="sm"
                        variant="secondary"
                        onClick={() => setBulkActionDialog('donation')}
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        Doação ({selectedItems.length})
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => setBulkActionDialog('disposal')}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Descarte ({selectedItems.length})
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsSelectionMode(true)}
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Selecionar para Doação/Descarte
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
            {filteredItems.length} {filteredItems.length === 1 ? 'item encontrado' : 'itens encontrados'}
            {isSelectionMode && ` | ${selectedItems.length} selecionado(s)`}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "item-card animate-fade-in cursor-pointer relative",
                  isSelectionMode && selectedItems.includes(item.id) && "ring-2 ring-primary"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => handleItemClick(item)}
              >
                {isSelectionMode && item.status === 'expired' && (
                  <div className="absolute top-2 right-2">
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleItemSelection(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
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
                        <Building2 className="w-4 h-4" />
                        <span className="truncate font-medium text-primary">{item.campus}</span>
                      </div>
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
    </MainLayout>
  );
}